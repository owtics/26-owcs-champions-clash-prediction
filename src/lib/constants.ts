// ─── Tournament Configuration ──────────────────────────────────────────────

export const TOURNAMENT_NAME = "OWCS CHAMPIONS CLASH Pick'Ems";
export const TOURNAMENT_DATES = "Hosted by OWTICS.GG X OWCS GALLERY";

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
  1: 5,  2: 5,  3: 5,  4: 5,  // WB Round 1
  5: 5,  6: 5,                  // LB Round 1
  7: 6,  8: 6,                  // WB Semifinals
  9: 8,  10: 8, 11: 8,          // LB Round 2, LB Round 3
  12: 10, 13: 10,               // WB Final, LB Final
  14: 20,                       // Grand Final
};

/** Maximum total score (sum of all MATCH_POINTS). */
export const MAX_SCORE = 106;

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
