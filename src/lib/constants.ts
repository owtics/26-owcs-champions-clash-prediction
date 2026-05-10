// ─── Tournament Configuration ──────────────────────────────────────────────

export const TOURNAMENT_NAME = "Champions Clash";
export const TOURNAMENT_DATES = "May 22 – May 24, 2026";

/**
 * Prediction deadline: May 22, 2026 at 00:00 KST (UTC+9)
 * Stored as UTC: May 21, 2026 at 15:00:00 UTC
 *
 * To change the deadline, update this value.
 * Always use UTC so the server stays timezone-agnostic.
 */
export const PREDICTION_DEADLINE = new Date("2026-05-21T15:00:00.000Z");

/**
 * Whether other users' predictions are visible after the deadline.
 * Set to false to keep them private until an admin publishes results.
 */
export const PREDICTIONS_PUBLIC_AFTER_DEADLINE = true;

// ─── Scoring ───────────────────────────────────────────────────────────────

/** Points awarded for correctly predicting the winner of each match. */
export const MATCH_POINTS: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1,           // WB Round 1
  5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, // LB R1, WB Semis, LB R2
  11: 3, 12: 3, 13: 3,              // LB R3, WB Final, LB Final
  14: 5,                            // Grand Final
};

/** Bonus points for correctly predicting the overall champion. */
export const CHAMPION_BONUS_POINTS = 5;

/** Total number of matches in the tournament. */
export const TOTAL_MATCHES = 14;

// ─── Round labels for the bracket UI ──────────────────────────────────────

export const ROUND_ORDER = [
  "WB Round 1",
  "LB Round 1",
  "WB Semifinals",
  "LB Round 2",
  "LB Round 3",
  "WB Final",
  "LB Final",
  "Grand Final",
] as const;
