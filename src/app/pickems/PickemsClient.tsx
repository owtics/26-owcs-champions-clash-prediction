"use client";

import { useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RawRow = Record<string, string>;

interface ProcessedRow {
  tournament_sheet: string;
  match_id: string;
  match_title: string;
  team_top: string;
  team_bottom: string;
  selected_team: string;
  pick_count: number;
  total_picks: number;
  expected_selection_rate: number; // 0–1
  actual_winner: string;
  advanced_team: string;
  next_match_id: string;
  next_match_pick_count: number | null;
  next_match_total_picks: number | null;
  later_pick_rate: number | null; // 0–1
  pick_rate_change: number | null;
  predicted_winner: string;
  correct_prediction: boolean | null;
  upset_score: number | null;
  match_format: string;
  rawRound: string;  // from CSV if present
  round: string;     // inferred or explicit
  roundOrder: number;
}

interface RoundGroup {
  roundName: string;
  order: number;
  matches: ProcessedRow[];
}

type Tab = "bracket" | "table" | "cards" | "charts";
type FilterCorrect = "all" | "correct" | "incorrect" | "no-result";

// ─────────────────────────────────────────────────────────────────────────────
// Pure data helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseRate(val: string | undefined): number | null {
  if (!val?.trim()) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

function parseNum(val: string | undefined): number | null {
  if (!val?.trim()) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function fmt(rate: number | null, decimals = 1): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(decimals)}%`;
}

function getOtherTeam(row: ProcessedRow): string {
  const sel = row.selected_team.toLowerCase();
  if (row.team_top.toLowerCase() === sel) return row.team_bottom;
  if (row.team_bottom.toLowerCase() === sel) return row.team_top;
  return row.team_bottom || row.team_top;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row processing
// ─────────────────────────────────────────────────────────────────────────────

function processRows(rows: RawRow[]): ProcessedRow[] {
  return rows.map((row) => {
    const pickRate = parseRate(row.pick_rate ?? row.expected_selection_rate);
    const laterRate = parseRate(row.next_match_pick_rate ?? row.later_pick_rate);
    const expected = pickRate ?? 0;
    const change = laterRate !== null ? laterRate - expected : null;
    const selected = (row.selected_team ?? "").trim();
    const actual = (row.actual_winner ?? "").trim();
    let correct: boolean | null = null;
    if (actual && selected) {
      correct = actual.toLowerCase() === selected.toLowerCase();
    }
    // Accept any common round/stage column name from the CSV
    const rawRound = (
      row.round ??
      row.stage ??
      row.bracket_round ??
      row.bracket_type ??
      row.phase ??
      ""
    ).trim();

    return {
      tournament_sheet: row.tournament_sheet ?? "",
      match_id: row.match_id ?? "",
      match_title: row.match_title ?? "",
      team_top: row.team_top ?? "",
      team_bottom: row.team_bottom ?? "",
      selected_team: selected,
      pick_count: parseNum(row.pick_count) ?? 0,
      total_picks: parseNum(row.total_picks) ?? 0,
      expected_selection_rate: expected,
      actual_winner: actual,
      advanced_team: row.advanced_team ?? "",
      next_match_id: row.next_match_id ?? "",
      next_match_pick_count: parseNum(row.next_match_pick_count),
      next_match_total_picks: parseNum(row.next_match_total_picks),
      later_pick_rate: laterRate,
      pick_rate_change: change,
      predicted_winner: selected,
      correct_prediction: correct,
      upset_score: correct === false ? 1 - expected : null,
      match_format: (row.match_format ?? row.format ?? "").trim(),
      rawRound,
      round: rawRound || "",  // filled in by attachRounds
      roundOrder: 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Round inference helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keyword-based round name inference from a match title.
 * Returns null if no keyword matches — the graph-depth fallback will be used.
 */
function inferRoundFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (/grand[\s_-]*final/.test(t)) return "Grand Final";
  if (/(upper|ub|wb|winners?)[\s_-]*(bracket[\s_-]*)?final/.test(t))
    return "Upper Bracket Final";
  if (/(lower|lb|losers?)[\s_-]*(bracket[\s_-]*)?final/.test(t))
    return "Lower Bracket Final";
  if (/(upper|ub|wb|winners?)[\s_-]*(bracket[\s_-]*)?semi/.test(t))
    return "Upper Bracket Semifinals";
  if (/(lower|lb|losers?)[\s_-]*(bracket[\s_-]*)?semi/.test(t))
    return "Lower Bracket Semifinals";
  if (/\bsemi[\s_-]?finals?\b/.test(t)) return "Semifinals";
  if (/\bquarter[\s_-]?finals?\b/.test(t)) return "Quarterfinals";
  if (/\bfinals?\b/.test(t)) return "Final";
  const rMatch = t.match(/round[\s_-]*(\d+)|[\s_-]r(\d+)\b/);
  if (rMatch) return `Round ${rMatch[1] ?? rMatch[2]}`;
  if (/(upper|ub|wb|winners?)\s*(bracket|round)/.test(t)) return "Upper Bracket";
  if (/(lower|lb|losers?)\s*(bracket|round)/.test(t)) return "Lower Bracket";
  return null;
}

/**
 * Computes bracket depth for each match using topological BFS from roots
 * (matches that no other match's winner feeds into).
 *
 * depth[match] = max depth of any predecessor + 1, or 0 for roots.
 * This respects double-elimination paths where multiple shorter paths
 * merge into a single later match.
 */
function computeDepthsFromStart(rows: ProcessedRow[]): Map<string, number> {
  const allIds = new Set(rows.map((r) => r.match_id));
  const nextMap = new Map(rows.map((r) => [r.match_id, r.next_match_id]));

  // prevMap[m] = match_ids whose winners advance into m
  const prevMap = new Map<string, string[]>();
  for (const [id, next] of nextMap) {
    if (next && allIds.has(next)) {
      if (!prevMap.has(next)) prevMap.set(next, []);
      prevMap.get(next)!.push(id);
    }
  }

  // In-degree = number of predecessors (used for Kahn BFS)
  const inDegree = new Map<string, number>();
  allIds.forEach((id) => inDegree.set(id, (prevMap.get(id) ?? []).length));

  const depth = new Map<string, number>();
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) { depth.set(id, 0); queue.push(id); }
  });

  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    const next = nextMap.get(id);
    if (next && allIds.has(next)) {
      // depth of next = max(current depth of next, d+1)
      depth.set(next, Math.max(depth.get(next) ?? 0, d + 1));
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg <= 0) queue.push(next);
    }
  }

  // Safety: any cycle or disconnected node gets depth 0
  allIds.forEach((id) => { if (!depth.has(id)) depth.set(id, 0); });
  return depth;
}

/**
 * Attaches `round` and `roundOrder` to every ProcessedRow.
 *
 * Priority:
 *   1. Explicit round column from CSV (rawRound)
 *   2. Keyword match from match_title (inferRoundFromTitle)
 *   3. Graph-depth inference (computeDepthsFromStart)
 *   4. "Unknown Round" fallback
 */
function attachRounds(rows: ProcessedRow[]): ProcessedRow[] {
  // Priority 1: explicit CSV column
  if (rows.some((r) => r.rawRound)) {
    const orderMap = new Map<string, number>();
    let o = 0;
    rows.forEach((r) => {
      const key = r.rawRound || "Unknown Round";
      if (!orderMap.has(key)) orderMap.set(key, o++);
    });
    return rows.map((r) => ({
      ...r,
      round: r.rawRound || "Unknown Round",
      roundOrder: orderMap.get(r.rawRound || "Unknown Round") ?? 0,
    }));
  }

  // Priority 2: title keywords
  const titleRoundMap = new Map<string, string>();
  rows.forEach((r) => {
    const inferred = inferRoundFromTitle(r.match_title);
    if (inferred) titleRoundMap.set(r.match_id, inferred);
  });

  // Priority 3: graph depth
  const depths = computeDepthsFromStart(rows);
  const maxDepth = Math.max(...depths.values(), 0);

  function depthToRoundName(d: number): string {
    if (d === maxDepth) return "Grand Final";
    const fromEnd = maxDepth - d;
    if (fromEnd === 1) return "Finals";
    if (fromEnd === 2) return "Semifinals";
    if (fromEnd === 3 && maxDepth >= 4) return "Quarterfinals";
    // Early rounds count up from Round 1
    return `Round ${d + 1}`;
  }

  return rows.map((r) => {
    const d = depths.get(r.match_id) ?? 0;
    const round = titleRoundMap.get(r.match_id) ?? depthToRoundName(d);
    return { ...r, round, roundOrder: d };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Groups rows into sorted bracket rounds.
 * Returns rounds ordered from earliest (Round 1) to latest (Grand Final).
 */
function groupMatchesByRound(rows: ProcessedRow[]): RoundGroup[] {
  const map = new Map<string, { order: number; matches: ProcessedRow[] }>();
  for (const row of rows) {
    const key = row.round || "Unknown Round";
    if (!map.has(key)) map.set(key, { order: row.roundOrder, matches: [] });
    map.get(key)!.matches.push(row);
  }
  return [...map.entries()]
    .map(([roundName, { order, matches }]) => ({ roundName, order, matches }))
    .sort((a, b) => a.order - b.order);
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics helper
// ─────────────────────────────────────────────────────────────────────────────

function calculatePredictionMetrics(rows: ProcessedRow[]) {
  if (!rows.length) return null;
  const avgFavoriteRate =
    rows.reduce((s, r) => s + r.expected_selection_rate, 0) / rows.length;
  const mostOneSided = rows.reduce((best, r) =>
    r.expected_selection_rate > best.expected_selection_rate ? r : best
  );
  const closest = rows.reduce((best, r) =>
    Math.abs(r.expected_selection_rate - 0.5) <
    Math.abs(best.expected_selection_rate - 0.5)
      ? r
      : best
  );
  const withChange = rows.filter((r) => r.pick_rate_change !== null);
  const biggestIncrease = withChange.length
    ? withChange.reduce((best, r) =>
        (r.pick_rate_change ?? -Infinity) >
        (best.pick_rate_change ?? -Infinity)
          ? r
          : best
      )
    : null;
  return {
    avgFavoriteRate,
    mostOneSided,
    closest,
    biggestIncrease,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI micro-components
// ─────────────────────────────────────────────────────────────────────────────

function PickBar({
  label,
  rate,
  bold,
  colorClass,
}: {
  label: string;
  rate: number;
  bold?: boolean;
  colorClass: string;
}) {
  const pct = Math.min(Math.max(rate * 100, 2), 100);
  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-20 text-sm truncate ${
          bold ? "font-bold text-white" : "text-brand-subtext"
        }`}
      >
        {label}
      </span>
      <div className="flex-1 bg-brand-border/30 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-12 text-sm text-right font-mono ${
          bold ? "text-white" : "text-brand-subtext"
        }`}
      >
        {(rate * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function CorrectBadge({ value }: { value: boolean | null }) {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green">
        ✓ Correct
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red">
        ✗ Wrong
      </span>
    );
  return <span className="text-brand-muted text-xs">—</span>;
}

function ChangeChip({ change }: { change: number | null }) {
  if (change === null) return <span className="text-brand-muted text-xs">—</span>;
  const sign = change >= 0 ? "+" : "";
  const color =
    change > 0.05
      ? "text-brand-green"
      : change < -0.05
      ? "text-brand-red"
      : "text-brand-subtext";
  return (
    <span className={`text-xs font-mono font-semibold ${color}`}>
      {sign}
      {(change * 100).toFixed(1)}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bracket match card components
// ─────────────────────────────────────────────────────────────────────────────

function BracketTeamRow({
  name,
  rate,
  isWinner,
  isLoser,
  isFavorite,
  resultKnown,
}: {
  name: string;
  rate: number;
  isWinner: boolean;
  isLoser: boolean;
  isFavorite: boolean;
  resultKnown: boolean;
}) {
  const pct = Math.min(Math.max(rate * 100, 2), 100);
  // Only apply winner/loser colouring when a result is actually available
  const barColor = resultKnown && isWinner
    ? "bg-brand-green"
    : resultKnown && isLoser
    ? "bg-brand-border/30"
    : isFavorite
    ? "bg-brand-accent/70"
    : "bg-brand-border/50";
  const textColor = resultKnown && isWinner
    ? "text-brand-green font-bold"
    : resultKnown && isLoser
    ? "text-brand-muted"
    : isFavorite
    ? "text-white font-semibold"
    : "text-brand-subtext";

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs truncate max-w-[130px] flex items-center gap-1 ${textColor}`}>
          {resultKnown && isWinner && <span className="text-brand-green">✓</span>}
          {name}
        </span>
        <span className={`text-xs font-mono ml-2 flex-shrink-0 tabular-nums ${textColor}`}>
          {(rate * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-brand-border/20 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * renderBracketMatchCard — returns the JSX for a single bracket match card.
 * Exported as a named function per the requirements.
 */
function renderBracketMatchCard(row: ProcessedRow): React.ReactNode {
  return <BracketMatchCard key={row.match_id} row={row} />;
}

function BracketMatchCard({ row }: { row: ProcessedRow }) {
  const topIsSelected =
    row.team_top.toLowerCase() === row.selected_team.toLowerCase();
  const topRate = topIsSelected
    ? row.expected_selection_rate
    : 1 - row.expected_selection_rate;
  const bottomRate = 1 - topRate;

  const resultKnown = !!row.actual_winner;
  const topIsWinner =
    resultKnown &&
    row.team_top.toLowerCase() === row.actual_winner.toLowerCase();
  const bottomIsWinner =
    resultKnown &&
    row.team_bottom.toLowerCase() === row.actual_winner.toLowerCase();

  // Only colour the border when a result is actually known
  const borderColor = resultKnown
    ? row.correct_prediction === true
      ? "border-brand-green/50"
      : "border-brand-red/50"
    : "border-brand-border";

  return (
    <div
      className={`bg-brand-card border ${borderColor} rounded-lg overflow-hidden w-52 flex-shrink-0 hover:border-brand-accent/40 transition-colors`}
    >
      {/* Header: match ID — badge only when result is known */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-brand-border/50 bg-[#1a2030]">
        <span className="text-brand-muted text-[11px] font-mono font-semibold">
          {row.match_id}
        </span>
        {resultKnown ? (
          <CorrectBadge value={row.correct_prediction} />
        ) : (
          <span className="text-brand-muted text-[10px]">Pre-match</span>
        )}
      </div>

      {/* Team rows */}
      <BracketTeamRow
        name={row.team_top}
        rate={topRate}
        isWinner={topIsWinner}
        isLoser={resultKnown && !topIsWinner}
        isFavorite={topRate >= bottomRate}
        resultKnown={resultKnown}
      />
      <div className="h-px bg-brand-border/30 mx-3" />
      <BracketTeamRow
        name={row.team_bottom}
        rate={bottomRate}
        isWinner={bottomIsWinner}
        isLoser={resultKnown && !bottomIsWinner}
        isFavorite={bottomRate > topRate}
        resultKnown={resultKnown}
      />

      {/* Later pick rate footer — only rendered when data is present */}
      {row.later_pick_rate !== null && (
        <div className="px-3 py-2 border-t border-brand-border/50 bg-[#1a2030]">
          <div className="text-[10px] text-brand-muted truncate">
            {row.advanced_team || row.selected_team}
            {" → "}
            {row.next_match_id}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-white font-mono tabular-nums">
              {fmt(row.later_pick_rate)}
            </span>
            <ChangeChip change={row.pick_rate_change} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bracket view
// ─────────────────────────────────────────────────────────────────────────────

/**
 * renderBracket — renders the full bracket section.
 * Named function wrapper per requirements; actual UI is in BracketView.
 */
function renderBracket(rows: ProcessedRow[]): React.ReactNode {
  return <BracketView rows={rows} />;
}

function BracketView({ rows }: { rows: ProcessedRow[] }) {
  const rounds = useMemo(() => groupMatchesByRound(rows), [rows]);

  if (!rows.length) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-xl p-8 text-center text-brand-subtext">
        No matches match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Direction hint */}
      <div className="flex items-center gap-3 text-[11px] text-brand-muted select-none">
        <span>Earlier rounds</span>
        <div className="flex-1 h-px bg-brand-border/30" />
        <span>Later rounds</span>
      </div>

      {/* Horizontal scrollable bracket columns */}
      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <div className="flex gap-4 min-w-max items-start">
          {rounds.map(({ roundName, matches }, colIdx) => (
            <div key={`${roundName}-${colIdx}`} className="flex flex-col items-center gap-3">
              {/* Round column header */}
              <div className="w-52 text-center">
                <div className="text-xs font-semibold text-white uppercase tracking-wider bg-brand-card border border-brand-border/80 rounded-lg px-3 py-2">
                  {roundName}
                </div>
                <div className="text-[10px] text-brand-muted mt-1">
                  {matches.length} match{matches.length !== 1 ? "es" : ""}
                </div>
              </div>

              {/* Match cards */}
              <div className="flex flex-col gap-3">
                {matches.map((row, i) => (
                  <BracketMatchCard key={`${row.match_id}-${i}`} row={row} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-brand-muted pt-1">
        {rows.some((r) => r.actual_winner) && (
          <>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-brand-green mr-1 align-middle" />
              Correct
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-brand-red mr-1 align-middle" />
              Wrong
            </span>
          </>
        )}
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-brand-accent/70 mr-1 align-middle" />
          Most Selected
        </span>
        <span className="ml-auto hidden md:block">
          Bar width = selection rate %
          {rows.some((r) => r.later_pick_rate !== null) &&
            " · footer shows next-match pick% after advancing"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table view
// ─────────────────────────────────────────────────────────────────────────────

function TableView({ rows }: { rows: ProcessedRow[] }) {
  if (!rows.length) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-xl p-8 text-center text-brand-subtext">
        No matches match the current filters.
      </div>
    );
  }
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border text-brand-subtext text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left">Round</th>
            <th className="px-4 py-3 text-left">Match</th>
            <th className="px-4 py-3 text-left">Top</th>
            <th className="px-4 py-3 text-left">Bottom</th>
            <th className="px-4 py-3 text-left">Picked Team</th>
            <th className="px-4 py-3 text-right">Selection Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.match_id}-${i}`}
              className="border-b border-brand-border/50 hover:bg-brand-border/10 transition-colors"
            >
              <td className="px-4 py-3 text-brand-subtext text-xs whitespace-nowrap">
                {row.round || "—"}
              </td>
              <td className="px-4 py-3 text-white font-medium">
                {row.match_title || row.match_id || "—"}
              </td>
              <td className="px-4 py-3 text-brand-subtext">{row.team_top || "—"}</td>
              <td className="px-4 py-3 text-brand-subtext">{row.team_bottom || "—"}</td>
              <td className="px-4 py-3 text-brand-accent font-semibold">
                {row.selected_team || "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono text-white">
                {fmt(row.expected_selection_rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards view
// ─────────────────────────────────────────────────────────────────────────────

function MatchCard({ row }: { row: ProcessedRow }) {
  const otherTeam = getOtherTeam(row);
  const otherRate = 1 - row.expected_selection_rate;
  const isSelectedTop =
    row.team_top.toLowerCase() === row.selected_team.toLowerCase();

  // Only colour the border when a result is actually known
  const resultKnown = !!row.actual_winner;
  const borderColor = resultKnown
    ? row.correct_prediction === true
      ? "border-brand-green/40"
      : "border-brand-red/40"
    : "border-brand-border";

  return (
    <div
      className={`bg-brand-card border ${borderColor} rounded-xl p-5 space-y-4 hover:border-brand-accent/50 transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] text-brand-muted">
            {row.tournament_sheet}
            {row.round && (
              <span className="ml-2 text-brand-accent/70">{row.round}</span>
            )}
          </div>
          <div className="text-white font-semibold text-sm mt-0.5">
            {row.match_title || `${row.team_top} vs ${row.team_bottom}`}
          </div>
        </div>
        {/* Badge only rendered when a result is available */}
        {resultKnown && <CorrectBadge value={row.correct_prediction} />}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-brand-muted uppercase tracking-wider mb-1">
          Selection Rates
        </div>
        {isSelectedTop ? (
          <>
            <PickBar
              label={row.selected_team}
              rate={row.expected_selection_rate}
              bold
              colorClass="bg-brand-accent"
            />
            <PickBar
              label={otherTeam}
              rate={otherRate}
              colorClass="bg-brand-border"
            />
          </>
        ) : (
          <>
            <PickBar
              label={otherTeam}
              rate={otherRate}
              colorClass="bg-brand-border"
            />
            <PickBar
              label={row.selected_team}
              rate={row.expected_selection_rate}
              bold
              colorClass="bg-brand-accent"
            />
          </>
        )}
      </div>

      {/* actual_winner intentionally not shown — these matches have not been played */}

      {row.later_pick_rate !== null && (
        <div className="border-t border-brand-border/50 pt-3 space-y-2">
          <div className="text-xs text-brand-muted uppercase tracking-wider">
            After advancing ({row.advanced_team || row.selected_team} →{" "}
            {row.next_match_id})
          </div>
          <PickBar
            label={row.advanced_team || row.selected_team}
            rate={row.later_pick_rate}
            bold
            colorClass={
              (row.pick_rate_change ?? 0) >= 0 ? "bg-brand-green" : "bg-brand-red"
            }
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-brand-muted">Change from pre-match:</span>
            <ChangeChip change={row.pick_rate_change} />
          </div>
        </div>
      )}
    </div>
  );
}

function CardsView({ rows }: { rows: ProcessedRow[] }) {
  if (!rows.length) {
    return (
      <div className="bg-brand-card border border-brand-border rounded-xl p-8 text-center text-brand-subtext">
        No matches match the current filters.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rows.map((row, i) => (
        <MatchCard key={`${row.match_id}-${i}`} row={row} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Charts view
// ─────────────────────────────────────────────────────────────────────────────

interface HBarEntry {
  label: string;
  sublabel?: string;
  value: number;
  colorClass: string;
}

function HBarChart({
  title,
  subtitle,
  entries,
  formatValue,
}: {
  title: string;
  subtitle?: string;
  entries: HBarEntry[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...entries.map((e) => Math.abs(e.value)), 0.001);
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-white font-semibold">{title}</h3>
        {subtitle && <p className="text-brand-subtext text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">
        {entries.map((e, i) => {
          const pct = (Math.abs(e.value) / max) * 100;
          const displayVal = formatValue ? formatValue(e.value) : fmt(e.value);
          return (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-brand-subtext truncate max-w-[55%]">{e.label}</span>
                {e.sublabel && (
                  <span className="text-brand-muted text-[10px]">{e.sublabel}</span>
                )}
                <span className="font-mono text-white font-semibold">{displayVal}</span>
              </div>
              <div className="bg-brand-border/30 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${e.colorClass}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-brand-muted text-sm text-center py-4">No data</div>
        )}
      </div>
    </div>
  );
}

function ChartsView({ rows }: { rows: ProcessedRow[] }) {
  const oneSided = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.expected_selection_rate - a.expected_selection_rate)
        .slice(0, 10)
        .map((r) => ({
          label: r.match_title || `${r.team_top} vs ${r.team_bottom}`,
          sublabel: r.selected_team,
          value: r.expected_selection_rate,
          colorClass: "bg-brand-accent",
        })),
    [rows]
  );

  const closest = useMemo(
    () =>
      [...rows]
        .sort(
          (a, b) =>
            Math.abs(a.expected_selection_rate - 0.5) -
            Math.abs(b.expected_selection_rate - 0.5)
        )
        .slice(0, 10)
        .map((r) => ({
          label: r.match_title || `${r.team_top} vs ${r.team_bottom}`,
          sublabel: r.selected_team,
          value: r.expected_selection_rate,
          colorClass: "bg-brand-gold",
        })),
    [rows]
  );

  const withChange = useMemo(
    () => rows.filter((r) => r.pick_rate_change !== null),
    [rows]
  );

  const biggestIncrease = useMemo(
    () =>
      [...withChange]
        .sort((a, b) => (b.pick_rate_change ?? 0) - (a.pick_rate_change ?? 0))
        .slice(0, 10)
        .map((r) => ({
          label: r.advanced_team || r.selected_team,
          sublabel: `${r.match_id}→${r.next_match_id}`,
          value: r.pick_rate_change!,
          colorClass: "bg-brand-green",
        })),
    [withChange]
  );

  const biggestDrop = useMemo(
    () =>
      [...withChange]
        .sort((a, b) => (a.pick_rate_change ?? 0) - (b.pick_rate_change ?? 0))
        .slice(0, 10)
        .map((r) => ({
          label: r.advanced_team || r.selected_team,
          sublabel: `${r.match_id}→${r.next_match_id}`,
          value: r.pick_rate_change!,
          colorClass: "bg-brand-red",
        })),
    [withChange]
  );

  const fmtChange = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <HBarChart
        title="Top 10 Most One-Sided Predictions"
        subtitle="Matches where one team was picked by the most users"
        entries={oneSided}
      />
      <HBarChart
        title="Top 10 Closest Predictions"
        subtitle="Matches where pick rates were nearest to 50/50"
        entries={closest}
      />
      <HBarChart
        title="Biggest Pick-Rate Increase After Advancing"
        subtitle="Teams that gained the most confidence in the next match"
        entries={biggestIncrease}
        formatValue={fmtChange}
      />
      <HBarChart
        title="Biggest Pick-Rate Drop After Advancing"
        subtitle="Teams that lost the most confidence in the next match"
        entries={biggestDrop}
        formatValue={fmtChange}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function PickemsClient() {
  const [rows, setRows] = useState<ProcessedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("bracket");

  // Filters
  const [filterTournament, setFilterTournament] = useState("all");
  const [filterRound, setFilterRound] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterCorrect, setFilterCorrect] = useState<FilterCorrect>("all");
  const [filterClose, setFilterClose] = useState(false);

  useEffect(() => {
    fetch("/api/pickems")
      .then((r) => r.json())
      .then((data) => {
        if (data.error && !data.rows?.length) setError(data.error);
        const processed = processRows(data.rows ?? []);
        setRows(attachRounds(processed));
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  // Derived filter option lists
  const tournaments = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.tournament_sheet).filter(Boolean))).sort(),
    [rows]
  );
  const rounds = useMemo(() => {
    const groups = groupMatchesByRound(rows);
    return groups.map((g) => g.roundName);
  }, [rows]);
  const teams = useMemo(
    () =>
      Array.from(
        new Set(rows.flatMap((r) => [r.team_top, r.team_bottom]).filter(Boolean))
      ).sort(),
    [rows]
  );
  const formats = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.match_format).filter(Boolean))).sort(),
    [rows]
  );

  // Filtered rows (used by all views)
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterTournament !== "all" && r.tournament_sheet !== filterTournament)
        return false;
      if (filterRound !== "all" && r.round !== filterRound) return false;
      if (
        filterTeam !== "all" &&
        r.team_top !== filterTeam &&
        r.team_bottom !== filterTeam
      )
        return false;
      if (filterCorrect === "correct" && r.correct_prediction !== true) return false;
      if (filterCorrect === "incorrect" && r.correct_prediction !== false) return false;
      if (filterCorrect === "no-result" && r.correct_prediction !== null) return false;
      if (filterClose && Math.abs(r.expected_selection_rate - 0.5) > 0.1) return false;
      return true;
    });
  }, [rows, filterTournament, filterRound, filterTeam, filterCorrect, filterClose]);

  // Summary stats over all rows (not filtered — always based on full dataset)
  const stats = useMemo(() => calculatePredictionMetrics(rows), [rows]);

  // Presence flags — drive conditional rendering throughout the page
  const hasResults = useMemo(() => rows.some((r) => !!r.actual_winner), [rows]);
  const hasLaterData = useMemo(() => rows.some((r) => r.later_pick_rate !== null), [rows]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-subtext animate-pulse">Loading Pick&apos;em data…</div>
      </div>
    );
  }

  // ── CSV error ──
  if (error && !rows.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Pick&apos;em Predictions</h1>
        <div className="bg-brand-card border border-brand-red/40 rounded-xl p-6 space-y-2">
          <p className="text-brand-red font-semibold">CSV not loaded</p>
          <p className="text-brand-subtext text-sm">{error}</p>
          <p className="text-brand-subtext text-sm mt-2">
            Place your CSV at{" "}
            <code className="text-brand-accent bg-brand-border/50 px-1 rounded">
              public/data/predictionpick.csv
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Pick&apos;em Predictions</h1>
        <p className="text-brand-subtext text-sm mt-1">
          Fan selection rates before matches are played · bracket view
        </p>
      </div>

      {/* ── Disclaimer ── */}
      <div className="bg-brand-card border border-brand-border/60 rounded-xl px-4 py-3 text-sm text-brand-subtext">
        These are Pick&apos;em selection rates before the matches are played. They do not represent actual winners or official win probabilities.
      </div>

      {/* ── Summary cards ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <div className="text-brand-subtext text-xs uppercase tracking-wider font-medium">
              Total Matches
            </div>
            <div className="text-3xl font-bold text-white mt-1">{rows.length}</div>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <div className="text-brand-subtext text-xs uppercase tracking-wider font-medium">
              Avg Selection Rate
            </div>
            <div className="text-3xl font-bold text-brand-accent mt-1">
              {fmt(stats.avgFavoriteRate)}
            </div>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <div className="text-brand-subtext text-xs uppercase tracking-wider font-medium">
              Most One-Sided
            </div>
            <div className="text-lg font-bold text-white mt-1 truncate">
              {stats.mostOneSided.selected_team}
            </div>
            <div className="text-brand-accent text-sm">
              {fmt(stats.mostOneSided.expected_selection_rate)}
            </div>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <div className="text-brand-subtext text-xs uppercase tracking-wider font-medium">
              Closest Match
            </div>
            <div className="text-sm font-bold text-white mt-1 leading-tight line-clamp-2">
              {stats.closest.match_title ||
                `${stats.closest.team_top} vs ${stats.closest.team_bottom}`}
            </div>
            <div className="text-brand-gold text-sm mt-0.5">
              {fmt(stats.closest.expected_selection_rate)}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Tournament */}
          <div className="flex items-center gap-2">
            <span className="text-brand-subtext text-xs uppercase tracking-wider">
              Tournament
            </span>
            <select
              value={filterTournament}
              onChange={(e) => setFilterTournament(e.target.value)}
              className="bg-brand-border text-white text-sm rounded-md px-2 py-1 border border-brand-border/80 focus:outline-none focus:border-brand-accent"
            >
              <option value="all">All</option>
              {tournaments.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Round */}
          <div className="flex items-center gap-2">
            <span className="text-brand-subtext text-xs uppercase tracking-wider">
              Round
            </span>
            <select
              value={filterRound}
              onChange={(e) => setFilterRound(e.target.value)}
              className="bg-brand-border text-white text-sm rounded-md px-2 py-1 border border-brand-border/80 focus:outline-none focus:border-brand-accent"
            >
              <option value="all">All Rounds</option>
              {rounds.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Team */}
          <div className="flex items-center gap-2">
            <span className="text-brand-subtext text-xs uppercase tracking-wider">
              Team
            </span>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="bg-brand-border text-white text-sm rounded-md px-2 py-1 border border-brand-border/80 focus:outline-none focus:border-brand-accent"
            >
              <option value="all">All Teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Format (shown only if CSV has match_format data) */}
          {formats.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-brand-subtext text-xs uppercase tracking-wider">
                Format
              </span>
              <select
                className="bg-brand-border text-white text-sm rounded-md px-2 py-1 border border-brand-border/80 focus:outline-none focus:border-brand-accent"
                defaultValue="all"
              >
                <option value="all">All</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Prediction result — only shown once actual_winner data is present */}
          {hasResults && (
            <div className="flex items-center gap-2">
              <span className="text-brand-subtext text-xs uppercase tracking-wider">
                Result
              </span>
              <select
                value={filterCorrect}
                onChange={(e) => setFilterCorrect(e.target.value as FilterCorrect)}
                className="bg-brand-border text-white text-sm rounded-md px-2 py-1 border border-brand-border/80 focus:outline-none focus:border-brand-accent"
              >
                <option value="all">All</option>
                <option value="correct">Correct</option>
                <option value="incorrect">Wrong Pick</option>
                <option value="no-result">No Result</option>
              </select>
            </div>
          )}

          {/* Close matches */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterClose}
              onChange={(e) => setFilterClose(e.target.checked)}
              className="accent-brand-accent"
            />
            <span className="text-brand-subtext text-xs uppercase tracking-wider">
              Close Only (±10%)
            </span>
          </label>

          {/* Reset */}
          <button
            onClick={() => {
              setFilterTournament("all");
              setFilterRound("all");
              setFilterTeam("all");
              setFilterCorrect("all");
              setFilterClose(false);
            }}
            className="text-brand-muted hover:text-white text-xs transition-colors"
          >
            Reset
          </button>

          <span className="ml-auto text-brand-subtext text-xs">
            {filteredRows.length} / {rows.length} matches
          </span>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 bg-brand-card border border-brand-border rounded-xl p-1 w-fit">
        {(["bracket", "table", "cards", "charts"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-brand-accent text-white"
                : "text-brand-subtext hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Views ── */}
      {tab === "bracket" && renderBracket(filteredRows)}
      {tab === "table" && <TableView rows={filteredRows} />}
      {tab === "cards" && <CardsView rows={filteredRows} />}
      {tab === "charts" && <ChartsView rows={rows} />}

      {/* ── Footer note ── */}
      <div className="text-xs text-brand-muted pb-4 border-t border-brand-border/30 pt-3">
        <strong className="text-brand-subtext">Note:</strong> Selection rates on this
        page are <em>fan prediction rates before matches are played</em> — how often
        users picked each team. These are entirely separate from hero pick/ban rates and
        do not represent actual winners or official win probabilities.
      </div>
    </div>
  );
}
