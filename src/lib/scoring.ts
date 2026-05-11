/**
 * scoring.ts — Score calculation for Champions Clash predictions.
 *
 * Compares each user's predicted winner per match against actual results,
 * awards points, and writes Score + PredictionPick.isCorrect to the DB.
 */

import { prisma } from "@/lib/prisma";
import { MATCH_POINTS } from "@/lib/constants";

// Re-export so callers can import from scoring.ts directly.
export { MATCH_POINTS, MAX_SCORE } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────

export interface MatchResult {
  matchNumber: number;
  actualWinnerCode: string | null;
}

export interface UserScoreResult {
  userId: string;
  totalScore: number;
  correctMatchCount: number;
  championCorrect: boolean;
}

// ─── Score one user ────────────────────────────────────────────────────────

async function scoreOneUser(
  userId: string,
  actualResults: Map<number, string | null>
): Promise<UserScoreResult> {
  const prediction = await prisma.prediction.findUnique({
    where: { userId },
    include: {
      picks: {
        include: {
          predictedWinner: true,
        },
      },
      champion: true,
    },
  });

  if (!prediction) {
    return { userId, totalScore: 0, correctMatchCount: 0, championCorrect: false };
  }

  let totalScore = 0;
  let correctMatchCount = 0;

  // Score each pick (purely match-based, no champion bonus)
  for (const pick of prediction.picks) {
    const actualWinner = actualResults.get(pick.matchNumber) ?? null;
    const predicted    = pick.predictedWinner?.code ?? null;

    const isCorrect = !!actualWinner && actualWinner === predicted;
    const points    = isCorrect ? (MATCH_POINTS[pick.matchNumber] ?? 0) : 0;

    if (isCorrect) correctMatchCount++;
    totalScore += points;

    await prisma.predictionPick.update({
      where: { id: pick.id },
      data: { isCorrect, pointsAwarded: points },
    });
  }

  // Track whether champion prediction was correct (stored for reference, no bonus)
  const actualChampion  = actualResults.get(14) ?? null;
  const predictedChamp  = prediction.champion?.code ?? null;
  const championCorrect = !!actualChampion && actualChampion === predictedChamp;

  await prisma.score.upsert({
    where: { userId },
    update: { totalScore, correctMatchCount, championCorrect },
    create: { userId, totalScore, correctMatchCount, championCorrect },
  });

  return { userId, totalScore, correctMatchCount, championCorrect };
}

// ─── Score all users ───────────────────────────────────────────────────────

/**
 * Recalculate scores for every user that has submitted a prediction.
 * Safe to call multiple times — results are idempotent given the same actual results.
 */
export async function recalculateAllScores(): Promise<UserScoreResult[]> {
  const matches = await prisma.match.findMany({
    where: { actualWinnerTeamId: { not: null } },
    include: { actualWinner: true },
  });

  const actualResults = new Map<number, string | null>();
  for (const m of matches) {
    actualResults.set(m.matchNumber, m.actualWinner?.code ?? null);
  }

  const predictions = await prisma.prediction.findMany({
    select: { userId: true },
  });

  const results: UserScoreResult[] = [];
  for (const p of predictions) {
    const r = await scoreOneUser(p.userId, actualResults);
    results.push(r);
  }

  return results;
}

/**
 * Recalculate the score for a single user.
 */
export async function recalculateUserScore(userId: string): Promise<UserScoreResult> {
  const matches = await prisma.match.findMany({
    where: { actualWinnerTeamId: { not: null } },
    include: { actualWinner: true },
  });

  const actualResults = new Map<number, string | null>();
  for (const m of matches) {
    actualResults.set(m.matchNumber, m.actualWinner?.code ?? null);
  }

  return scoreOneUser(userId, actualResults);
}
