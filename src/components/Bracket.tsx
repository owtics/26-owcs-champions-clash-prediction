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
// Column layout (CARD_W=170, gap=50):
//   col1=16  right=186
//   col2=236 right=406
//   col3=456 right=626
//   col4=676 right=846
//   col5=896 right=1066
// CANVAS_W = 1066 + 16 padding = 1082

const CARD_W   = 200;
const CARD_H   = 104;   // increased to account for status strip height
const CANVAS_W = 1195;
const CANVAS_H = 960;

// Column layout: col1=4, col2=236, col3=475, col4=720, col5=990
// CARD_H=104, vertical gap between cards=56px
// WB R1 tops: 40, 200, 360, 520
// LB R1 tops: 640, 800 (below WB R2 bottom=624)

const MATCH_POS: Record<number, { left: number; top: number }> = {
  // WB Round 1 (col1)
  4:  { left: 4,   top: 40  },
  3:  { left: 4,   top: 200 },
  1:  { left: 4,   top: 360 },
  2:  { left: 4,   top: 520 },
  // WB Semifinals (col2)
  7:  { left: 236, top: 120 },   // center(M4,M3): (92+252)/2 − 52 = 120
  8:  { left: 236, top: 440 },   // center(M1,M2): (412+572)/2 − 52 = 440
  // WB Final (col4)
  12: { left: 720, top: 280 },   // center(M7,M8): (172+492)/2 − 52 = 280
  // Grand Final (col5)
  14: { left: 990, top: 500 },   // center(M12,M13): (332+772)/2 − 52 = 500
  // LB Round 1 (col1, below WB)
  5:  { left: 4,   top: 660 },
  6:  { left: 4,   top: 800 },
  // LB Round 2 (col2)
  9:  { left: 236, top: 660 },
  10: { left: 236, top: 800 },
  // LB Round 3 (col3)
  11: { left: 475, top: 720 },   // center(M9,M10): (692+852)/2 − 52 = 720
  // LB Final (col4)
  13: { left: 720, top: 720 },
};

// Round labels: shown above each column section
const ROUND_LABELS = [
  { label: "WB Round 1",    left: 64,   top: -5  },
  { label: "WB Semifinals", left: 300,  top: -5  },
  { label: "WB Final",      left: 790,  top: -5  },
  { label: "LB Round 1",    left: 64,   top: 632 },
  { label: "LB Round 2",    left: 300,  top: 632 },
  { label: "LB Round 3",    left: 540,  top: 632 },
  { label: "LB Final",      left: 790,  top: 632 },
  { label: "Grand Final",   left: 1048, top: 465 },
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
          {/* WB Round 1 → WB Semifinals (midX between col1_right=186 and col2_left=236) */}
          <BracketConnector src1={4} src2={3} target={7}  midX={222} />
          <BracketConnector src1={1} src2={2} target={8}  midX={222} />

          {/* WB Semifinals → WB Final (midX between col2_right=436 and col4_left=720) */}
          <BracketConnector src1={7} src2={8} target={12} midX={578} />

          {/* WB Final → Grand Final */}
          <SingleConnector src={12} target={14} />

          {/* LB Round 1 → LB Round 2 */}
          <SingleConnector src={5}  target={9}  />
          <SingleConnector src={6}  target={10} />

          {/* LB Round 2 → LB Round 3 (midX between col2_right=406 and col3_left=456) */}
          <BracketConnector src1={9} src2={10} target={11} midX={455} />

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
