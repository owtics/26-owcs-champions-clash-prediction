/**
 * bracket.ts — Core double-elimination bracket logic for Champions Clash.
 *
 * Single source of truth used by:
 *   1. The prediction UI   – propagates user picks into later match slots
 *   2. The admin system    – propagates actual results into later match slots
 *   3. Score calculation   – resolves which teams are compared per match
 *
 * ─── Tournament Structure ────────────────────────────────────────────────────
 *
 *  WB Round 1 (M1-M4)       WB Semifinals (M7, M8)   WB Final (M12)
 *  ┌──────────┐
 *  │ M3 (top) │──── M3 winner ──→ M7 top ──┐
 *  │ M4 (bot) │──── M4 winner ──→ M7 bot ──┴──→ M7 winner ──→ M12 top ──┐
 *  │ M1 (top) │──── M1 winner ──→ M8 top ──┐                              │──→ M14
 *  │ M2 (bot) │──── M2 winner ──→ M8 bot ──┴──→ M8 winner ──→ M12 bot ──┘
 *  └──────────┘
 *
 *  LB Round 1 (M5, M6)   LB Round 2 (M9, M10)   LB R3 (M11)   LB Final (M13)
 *  M3 loser ──→ M6 top ──┐                                               ↓
 *  M4 loser ──→ M6 bot ──┴──→ M6 winner ──→ M10 bot ──┐
 *  M1 loser ──→ M5 top ──┐                              │──→ M10 winner ──→ M11 bot ──┐
 *  M2 loser ──→ M5 bot ──┴──→ M5 winner ──→ M9  bot ──┐                               │──→ M13 top ──→ M14 bot
 *  M7 loser ──────────────────────────────→ M9  top ──┴──→ M9  winner ──→ M11 top ──┘
 *  M8 loser ──────────────────────────────→ M10 top ──┘
 *  M12 loser ──────────────────────────────────────────────────────────→ M13 bot
 *
 * ─── Slot convention ─────────────────────────────────────────────────────────
 *  "top"    → team1  (rendered in the top row of a MatchCard)
 *  "bottom" → team2  (rendered in the bottom row of a MatchCard)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Resolved state for a single match. */
export interface MatchState {
  team1: string | null;   // top slot
  team2: string | null;   // bottom slot
  winner: string | null;
}

/** Full bracket state: matchNumber → MatchState */
export type BracketState = Map<number, MatchState>;

/** Initial seeded teams for WB Round 1 matches (1–4). */
export type InitialTeams = Map<number, { team1: string | null; team2: string | null }>;

/** User/admin pick map: matchNumber → winner team code. */
export type PickMap = Map<number, string | null>;

// ─── Feed slot type ───────────────────────────────────────────────────────────

type FeedSlot = "top" | "bottom";

interface MatchFeed {
  sourceMatch: number;
  result:      "winner" | "loser";
  targetMatch: number;
  targetSlot:  FeedSlot;   // "top" → team1, "bottom" → team2
}

// ─── Declarative bracket feed map ────────────────────────────────────────────
//
// Every advancement rule in the tournament is listed here exactly once.
// This is the only place in the codebase that encodes bracket structure.
//
// Match pairing logic (mirroring the screenshot):
//   M3 + M4  →  WB Semi M7  (top half of bracket)
//   M1 + M2  →  WB Semi M8  (bottom half of bracket)
//   M1 + M2 losers  →  LB R1 M5
//   M3 + M4 losers  →  LB R1 M6

const BRACKET_FEEDS: MatchFeed[] = [
  // ── WB Round 1 → WB Semifinals ──────────────────────────────────────────
  // M3/M4 (top half) feed into M7
  { sourceMatch: 3, result: "winner", targetMatch: 7, targetSlot: "top"    },
  { sourceMatch: 4, result: "winner", targetMatch: 7, targetSlot: "bottom" },
  // M1/M2 (bottom half) feed into M8
  { sourceMatch: 1, result: "winner", targetMatch: 8, targetSlot: "top"    },
  { sourceMatch: 2, result: "winner", targetMatch: 8, targetSlot: "bottom" },

  // ── WB Round 1 → LB Round 1 (losers drop) ───────────────────────────────
  // M1/M2 losers → M5
  { sourceMatch: 1, result: "loser",  targetMatch: 5, targetSlot: "top"    },
  { sourceMatch: 2, result: "loser",  targetMatch: 5, targetSlot: "bottom" },
  // M3/M4 losers → M6
  { sourceMatch: 3, result: "loser",  targetMatch: 6, targetSlot: "top"    },
  { sourceMatch: 4, result: "loser",  targetMatch: 6, targetSlot: "bottom" },

  // ── WB Semifinals → WB Final ─────────────────────────────────────────────
  { sourceMatch: 7, result: "winner", targetMatch: 12, targetSlot: "top"    },
  { sourceMatch: 8, result: "winner", targetMatch: 12, targetSlot: "bottom" },

  // ── WB Semifinals → LB Round 2 (loser drops in as "fresh" top slot) ──────
  // WB Semi losers enter LB R2 from the top (seeded side)
  { sourceMatch: 7, result: "loser",  targetMatch: 9,  targetSlot: "top"    },
  { sourceMatch: 8, result: "loser",  targetMatch: 10, targetSlot: "top"    },

  // ── LB Round 1 → LB Round 2 (winners enter from bottom slot) ────────────
  // LB R1 winners enter LB R2 from the bottom (new-entrant side)
  { sourceMatch: 5, result: "winner", targetMatch: 9,  targetSlot: "bottom" },
  { sourceMatch: 6, result: "winner", targetMatch: 10, targetSlot: "bottom" },

  // ── LB Round 2 → LB Round 3 ──────────────────────────────────────────────
  { sourceMatch: 9,  result: "winner", targetMatch: 11, targetSlot: "top"    },
  { sourceMatch: 10, result: "winner", targetMatch: 11, targetSlot: "bottom" },

  // ── LB Round 3 → LB Final ────────────────────────────────────────────────
  { sourceMatch: 11, result: "winner", targetMatch: 13, targetSlot: "top"    },

  // ── WB Final → Grand Final + LB Final ────────────────────────────────────
  { sourceMatch: 12, result: "winner", targetMatch: 14, targetSlot: "top"    },
  { sourceMatch: 12, result: "loser",  targetMatch: 13, targetSlot: "bottom" },

  // ── LB Final → Grand Final ───────────────────────────────────────────────
  { sourceMatch: 13, result: "winner", targetMatch: 14, targetSlot: "bottom" },

  // M14 winner is the champion — no further advancement entry needed.
];

// Pre-index feeds by sourceMatch for O(1) lookup during propagation.
const FEEDS_BY_SOURCE = new Map<number, MatchFeed[]>();
for (const feed of BRACKET_FEEDS) {
  const existing = FEEDS_BY_SOURCE.get(feed.sourceMatch) ?? [];
  existing.push(feed);
  FEEDS_BY_SOURCE.set(feed.sourceMatch, existing);
}

// ─── Core propagation function ────────────────────────────────────────────────

/**
 * propagateBracket
 *
 * Pure function. Given:
 *   - picks        matchNumber → winner team code
 *   - initialTeams seeded team assignments for M1–M4
 *
 * Returns a fully resolved BracketState for all 14 matches:
 *   team1 (top slot), team2 (bottom slot), winner for each match.
 *
 * The function processes matches in ascending order (1 → 14) so every
 * source match is resolved before its target matches are written.
 */
export function propagateBracket(
  picks: PickMap,
  initialTeams: InitialTeams
): BracketState {
  const state: BracketState = new Map();

  // Initialise all matches with null teams and the caller-supplied winner (if any).
  for (let mn = 1; mn <= 14; mn++) {
    state.set(mn, { team1: null, team2: null, winner: picks.get(mn) ?? null });
  }

  // Seed WB Round 1 team assignments (M1–M4).
  for (const [mn, teams] of Array.from(initialTeams)) {
    const ms = state.get(mn)!;
    ms.team1 = teams.team1;
    ms.team2 = teams.team2;
  }

  // Helper: derive loser from winner + known teams.
  const getLoser = (mn: number): string | null => {
    const ms = state.get(mn)!;
    if (!ms.winner || !ms.team1 || !ms.team2) return null;
    return ms.team1 === ms.winner ? ms.team2 : ms.team1;
  };

  // Walk matches in order. Each match writes advancing teams into later matches
  // according to BRACKET_FEEDS, so downstream slots are always resolved after
  // the upstream match that feeds them.
  for (let mn = 1; mn <= 14; mn++) {
    const ms      = state.get(mn)!;
    const feeds   = FEEDS_BY_SOURCE.get(mn) ?? [];
    const winner  = ms.winner;
    const loser   = getLoser(mn);

    for (const feed of feeds) {
      // Determine the team to advance.
      const advancingTeam =
        feed.result === "winner" ? winner :
        feed.result === "loser"  ? loser  : null;

      if (!advancingTeam) continue; // match not yet decided — skip

      // Write into the correct slot of the target match.
      const target = state.get(feed.targetMatch)!;
      if (feed.targetSlot === "top") {
        target.team1 = advancingTeam;
      } else {
        target.team2 = advancingTeam;
      }
    }
  }

  return state;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Build a PickMap from a flat array of { matchNumber, winnerCode } objects.
 */
export function buildPickMap(
  rows: { matchNumber: number; winnerCode: string | null }[]
): PickMap {
  const map = new Map<number, string | null>();
  for (const r of rows) {
    map.set(r.matchNumber, r.winnerCode);
  }
  return map;
}

/**
 * Build an InitialTeams map from the seeded matches (M1–M4).
 */
export function buildInitialTeams(
  seededMatches: {
    matchNumber: number;
    team1Code: string | null;
    team2Code: string | null;
  }[]
): InitialTeams {
  const map = new Map<number, { team1: string | null; team2: string | null }>();
  for (const m of seededMatches) {
    map.set(m.matchNumber, { team1: m.team1Code, team2: m.team2Code });
  }
  return map;
}

/**
 * Returns true if both team slots for a match are known.
 * Used by the prediction UI to decide which matches are clickable.
 */
export function isMatchPredictable(
  matchNum: number,
  bracketState: BracketState
): boolean {
  const ms = bracketState.get(matchNum);
  if (!ms) return false;
  return !!ms.team1 && !!ms.team2;
}

/**
 * Returns match numbers that have both teams known but no pick yet.
 */
export function getPredictableMatches(
  bracketState: BracketState,
  picks: PickMap
): number[] {
  const result: number[] = [];
  for (let mn = 1; mn <= 14; mn++) {
    if (!picks.has(mn) && isMatchPredictable(mn, bracketState)) {
      result.push(mn);
    }
  }
  return result;
}

/**
 * Exported for documentation / admin UI that wants to display the full feed map.
 */
export { BRACKET_FEEDS };
export type { MatchFeed, FeedSlot };
