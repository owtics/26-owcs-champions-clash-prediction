"use client";

import { useMemo } from "react";
import MatchCard from "./MatchCard";
import {
  propagateBracket,
  buildPickMap,
  buildInitialTeams,
} from "@/lib/bracket";
import { MATCH_POINTS } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────

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
  pickPoints?: Record<number, number>;
  teamSeeds?: Record<string, number | null>;
  teamLogos?: Record<string, string | null>;
}

// ─── Compact layout constants ──────────────────────────────────────────────

const CARD_W   = 220;
const CARD_H   = 88;
const CANVAS_W = 1380;
const CANVAS_H = 692;

// Column left positions (gap = 60px between columns)
// col1=16  col2=296  col3=576  col4=856  col5=1136
// WB R1 → WB Semi → WB Final →(skip col4)→ GF
// LB R1 → LB R2  → LB R3   → LB Final  → GF

// Row gap: CARD_H + 10 = 98px
// WB start top = 60
// LB start top = WB last card bottom + 32 = (354+88)+32 = 474

const MATCH_POS: Record<number, { left: number; top: number }> = {
  // WB Round 1 (col1)
  4:  { left: 16,   top: 60  },
  3:  { left: 16,   top: 158 },
  1:  { left: 16,   top: 256 },
  2:  { left: 16,   top: 354 },
  // WB Semifinals (col2)
  7:  { left: 296,  top: 109 },   // center(M4,M3) - CARD_H/2 = 153-44=109
  8:  { left: 296,  top: 305 },   // center(M1,M2) - 44       = 349-44=305
  // WB Final (col3)
  12: { left: 576,  top: 207 },   // center(M7,M8) - 44       = 251-44=207
  // Grand Final (col5)
  14: { left: 1136, top: 364 },   // center(M12,M13) - 44     = 408-44=364
  // LB Round 1 (col1, below WB)
  5:  { left: 16,   top: 474 },
  6:  { left: 16,   top: 572 },
  // LB Round 2 (col2)
  9:  { left: 296,  top: 474 },
  10: { left: 296,  top: 572 },
  // LB Round 3 (col3)
  11: { left: 576,  top: 523 },   // center(M9,M10) - 44      = 567-44=523
  // LB Final (col4)
  13: { left: 856,  top: 523 },
};

// Round labels: shown above each column section
const ROUND_LABELS = [
  { label: "WB Round 1",    left: 16,   top: 32  },
  { label: "WB Semifinals", left: 296,  top: 32  },
  { label: "WB Final",      left: 576,  top: 32  },
  { label: "LB Round 1",    left: 16,   top: 446 },
  { label: "LB Round 2",    left: 296,  top: 446 },
  { label: "LB Round 3",    left: 576,  top: 446 },
  { label: "LB Final",      left: 856,  top: 446 },
  { label: "Grand Final",   left: 1136, top: 336 },
];

// ─── SVG Connectors ────────────────────────────────────────────────────────

function cardRight(mn: number) { return MATCH_POS[mn].left + CARD_W; }
function cardLeft(mn: number)  { return MATCH_POS[mn].left; }
function cardMidY(mn: number)  { return MATCH_POS[mn].top + CARD_H / 2; }

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

  return (
    <g stroke={stroke} strokeWidth={1.5} fill="none">
      <path d={`M ${x1} ${y1} H ${midX}`} />
      <path d={`M ${x2} ${y2} H ${midX}`} />
      <path d={`M ${midX} ${y1} V ${y2}`} />
      <path d={`M ${midX} ${(y1 + y2) / 2} H ${xTarget}`} />
    </g>
  );
}

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
  pickPoints,
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

  const resolveTeam = (code: string | null): BracketTeam => {
    if (!code) return { code: null };
    return {
      code,
      seed:    teamSeeds?.[code] ?? null,
      logoUrl: teamLogos?.[code] ?? null,
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
    const pointsAwarded   = pickPoints?.[mn] ?? null;
    const maxPoints       = MATCH_POINTS[mn] ?? 0;

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
          pointsAwarded={pointsAwarded}
          maxPoints={maxPoints}
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

        <svg
          style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
          width={CANVAS_W}
          height={CANVAS_H}
        >
          {/* WB Round 1 → WB Semifinals (midX between col1_right=236 and col2_left=296) */}
          <BracketConnector src1={4} src2={3} target={7}  midX={266} />
          <BracketConnector src1={1} src2={2} target={8}  midX={266} />

          {/* WB Semifinals → WB Final (midX between col2_right=516 and col3_left=576) */}
          <BracketConnector src1={7} src2={8} target={12} midX={546} />

          {/* WB Final → Grand Final */}
          <SingleConnector src={12} target={14} />

          {/* LB Round 1 → LB Round 2 */}
          <SingleConnector src={5}  target={9}  />
          <SingleConnector src={6}  target={10} />

          {/* LB Round 2 → LB Round 3 (midX same 546) */}
          <BracketConnector src1={9} src2={10} target={11} midX={546} />

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
              fontSize: 10,
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
