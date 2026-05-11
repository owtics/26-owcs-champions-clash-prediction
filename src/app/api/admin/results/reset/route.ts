/**
 * POST /api/admin/results/reset
 *
 * Admin only. Clears all actual match results and resets all scores.
 * Predictions (user picks) are preserved.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden – admin only." }, { status: 403 });
  }

  // Clear all actual match results and resolved team slots
  await prisma.match.updateMany({
    data: {
      actualWinnerTeamId: null,
      resolvedTeam1Id:    null,
      resolvedTeam2Id:    null,
    },
  });

  // Reset all pick scoring
  await prisma.predictionPick.updateMany({
    data: {
      isCorrect:     null,
      pointsAwarded: 0,
    },
  });

  // Reset all scores
  await prisma.score.updateMany({
    data: {
      totalScore:        0,
      correctMatchCount: 0,
      championCorrect:   false,
    },
  });

  return NextResponse.json({
    success: true,
    message: "All match results and scores have been reset.",
  });
}
