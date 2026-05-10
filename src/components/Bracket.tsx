"use client";

import { useMemo } from "react";
import MatchCard from "./MatchCard";
import {
  propagateBracket,
  buildPickMap,
  buildInitialTeams,
} from "@/lib/bracket";

// ─── Types (unchanged from original) ──────────────────────────────────────

export interface BracketTeam {
  code: string | null;
  name?: string | null;
  seed?: number | null;
  logoUrl?: string | null;
}

export interface BracketMatch {
  matchNumber: number;
  roundName: string;
  bracketType: string;
  team1: BracketTeam | null;
  team2: BracketTeam | null;
  actualWinnerCode?: string | null;
}

export type PickMap = Record<number, string>;

export interface BracketProps {
  matches: BracketMatch[];
  picks: PickMap;
  onPick?: (matchNumber: number, teamCode: string) => void;
  disabled?: boolean;
  showResults?: boolean;
  correctPicks?: Record<number, boolean | null>;
  teamSeeds?: Record<string, number | null>;
  teamLogos?: Record<string, string | null>;
}

// ─── Layout constants ──────────────────────────────────────────────────────

const CARD_W = 260;
const CARD_H = 88;
const CANVAS_W = 1740;
const CANVAS_H = 820;

// Absolute positions for each match card: matchNumber → { left, top }
const MATCH_POS: Record<number, { left: number; top: number }> = {
  // WB Round 1
  4:  { left: 16,   top: 70  },
  3:  { left: 16,   top: 182 },
  1:  { left: 16,   top: 294 },
  2:  { left: 16,   top: 406 },
  // WB Semifinals
  7:  { left: 376,  top: 126 },
  8:  { left: 376,  top: 350 },
  // WB Final
  12: { left: 736,  top: 238 },
  // Grand Final
  14: { left: 1456, top: 432 },
  // LB Round 1
  5:  { left: 16,   top: 540 },
  6:  { left: 16,   top: 652 },
  // LB Round 2
  9:  { left: 376,  top: 540 },
  10: { left: 376,  top: 652 },
  // LB Round 3
  11: { left: 736,  top: 596 },
  // LB Final
  13: { left: 1096, top: 596 },
};

// Round labels: { label, left, top }
const ROUND_LABELS = [
  { label: "승자조 1라운드", left: 16,   top: 42  },
  { label: "승자조 준결승",  left: 376,  top: 42  },
  { label: "승자조 결승",    left: 736,  top: 42  },
  { label: "패자조 1라운드", left: 16,   top: 512 },
  { label: "패자조 2라운드", left: 376,  top: 512 },
  { label: "패자조 3라운드", left: 736,  top: 512 },
  { label: "패자조 결승",    left: 1096, top: 512 },
  { label: "그랜드 파이널",  left: 1456, top: 404 },
];

// ─── SVG Connectors ────────────────────────────────────────────────────────

function cardRight(mn: number)  { return MATCH_POS[mn].left + CARD_W; }
function cardLeft(mn: number)   { return MATCH_POS[mn].left; }
function cardMidY(mn: number)   { return MATCH_POS[mn].top + CARD_H / 2; }

/**
 * Draw a bracket connector: two source cards connecting to one target card.
 */
function BracketConnector({
  src1, src2, target, midX, stroke = "#3f3f46",
}: {
  src1: number; src2: number; target: number; midX: number; stroke?: string;
}) {
  const x1 = cardRight(src1);
  const y1 = cardMidY(src1);
  const x2 = cardRight(src2);
  const y2 = cardMidY(src2);
  const xTarget = cardLeft(target);
  const yTarget = cardMidY(target);
  const yMid = (y1 + y2) / 2;

  return (
    <g stroke={stroke} strokeWidth={1.5} fill="none">
      {/* src1 → midX */}
      <path d={`M ${x1} ${y1} H ${midX}`} />
      {/* src2 → midX */}
      <path d={`M ${x2} ${y2} H ${midX}`} />
      {/* vertical connector */}
      <path d={`M ${midX} ${y1} V ${y2}`} />
      {/* midX → target */}
      <path d={`M ${midX} ${yMid} H ${xTarget}`} />
    </g>
  );
}

/**
 * Draw a single connector: one source card → one target card.
 */
function SingleConnector({
  src, target, stroke = "#3f3f46",
}: {
  src: number; target: number; stroke?: string;
}) {
  const x1 = cardRight(src);
  const y1 = cardMidY(src);
  const x2 = cardLeft(target);
  const y2 = cardMidY(target);
  const midX = x1 + (x2 - x1) / 2;

  return (
    <g stroke={stroke} strokeWidth={1.5} fill="none">
      <path d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} />
    </g>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function Bracket({
  matches,
  picks,
  onPick,
  disabled,
  showResults,
  correctPicks,
  teamSeeds,
  teamLogos,
}: BracketProps) {
  const matchByNum = useMemo(() => {
    const m = new Map<number, BracketMatch>();
    for (const match of matches) m.set(match.matchNumber, match);
    return m;
  }, [matches]);

  const initialTeams = useMemo(() =>
    buildInitialTeams(
      matches
        .filter((m) => m.matchNumber <= 4)
        .map((m) => ({
          matchNumber: m.matchNumber,
          team1Code:   m.team1?.code ?? null,
          team2Code:   m.team2?.code ?? null,
        }))
    ),
    [matches]
  );

  const bracketState = useMemo(() => {
    const pickMap = buildPickMap(
      Object.entries(picks).map(([mn, code]) => ({
        matchNumber: parseInt(mn, 10),
        winnerCode:  code,
      }))
    );
    return propagateBracket(pickMap, initialTeams);
  }, [picks, initialTeams]);

  // Resolve a team code into a full BracketTeam object for propagated (non-seeded) slots.
  // Looks up seed and logoUrl from the caller-provided lookup maps.
  const resolveTeam = (code: string | null): BracketTeam => {
    if (!code) return { code: null };
    return {
      code,
      seed:    teamSeeds?.[code]  ?? null,
      logoUrl: teamLogos?.[code]  ?? null,
    };
  };

  const renderMatch = (mn: number) => {
    const pos = MATCH_POS[mn];
    if (!pos) return null;
    const dbMatch = matchByNum.get(mn);
    if (!dbMatch) return null;

    const ms = bracketState.get(mn) ?? { team1: null, team2: null, winner: null };
    const t1 = mn <= 4 ? dbMatch.team1 : resolveTeam(ms.team1);
    const t2 = mn <= 4 ? dbMatch.team2 : resolveTeam(ms.team2);

    const predictedWinner = picks[mn] ?? null;
    const actualWinner    = dbMatch.actualWinnerCode ?? null;
    const isCorrect       = correctPicks?.[mn] ?? null;

    const canPick = !disabled && !!onPick && !!t1?.code && !!t2?.code;

    return (
      <div
        key={mn}
        style={{
          position: "absolute",
          left: pos.left,
          top: pos.top,
          width: CARD_W,
          zIndex: 1,
        }}
      >
        <MatchCard
          matchNumber={mn}
          roundName={dbMatch.roundName}
          team1={t1}
          team2={t2}
          predictedWinner={predictedWinner}
          actualWinner={actualWinner}
          isCorrect={isCorrect}
          showResult={showResults}
          disabled={!canPick}
          onPickWinner={canPick ? (code) => onPick!(mn, code) : undefined}
        />
      </div>
    );
  };

  return (
    <div style={{ overflowX: "auto", overflowY: "visible", paddingBottom: 16 }}>
      <div style={{ position: "relative", width: CANVAS_W, height: CANVAS_H }}>

        {/* SVG connector lines — behind cards */}
        <svg
          style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
          width={CANVAS_W}
          height={CANVAS_H}
        >
          {/* WB Round 1 → WB Semifinals */}
          <BracketConnector src1={4} src2={3} target={7} midX={316} />
          <BracketConnector src1={1} src2={2} target={8} midX={316} />

          {/* WB Semifinals → WB Final */}
          <BracketConnector src1={7} src2={8} target={12} midX={676} />

          {/* WB Final → Grand Final */}
          <SingleConnector src={12} target={14} />

          {/* LB Round 1 → LB Round 2 */}
          <SingleConnector src={5} target={9} />
          <SingleConnector src={6} target={10} />

          {/* LB Round 2 → LB Round 3 */}
          <BracketConnector src1={9} src2={10} target={11} midX={676} />

          {/* LB Round 3 → LB Final */}
          <SingleConnector src={11} target={13} />

          {/* LB Final → Grand Final */}
          <SingleConnector src={13} target={14} />
        </svg>

        {/* Round labels */}
        {ROUND_LABELS.map((r) => (
          <div
            key={r.label}
            style={{ position: "absolute", left: r.left, top: r.top, zIndex: 2 }}
          >
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#94a3b8",
            }}>
              {r.label}
            </span>
          </div>
        ))}

        {/* Match cards */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(renderMatch)}
      </div>
    </div>
  );
}
