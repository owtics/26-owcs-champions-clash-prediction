import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PREDICTION_DEADLINE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const deadlinePassed = now >= PREDICTION_DEADLINE;

  const scores = await prisma.score.findMany({
    include: {
      user: {
        select: {
          id:       true,
          username: true,
          prediction: {
            select: {
              submittedAt: true,
              updatedAt:   true,
              champion:    { select: { code: true, name: true } },
              picks: {
                where: { matchNumber: 14 },
                select: { predictedWinner: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { totalScore: "desc" },
    ],
  });

  // Build leaderboard rows
  const rows = scores.map((s) => {
    const pred = s.user.prediction;
    return {
      userId:          s.userId,
      username:        s.user.username,
      totalScore:      s.totalScore,
      correctMatchCount: s.correctMatchCount,
      championCorrect: s.championCorrect,
      predictedChampion: pred?.champion?.code ?? null,
      grandFinalPick:  pred?.picks?.[0]?.predictedWinner?.code ?? null,
      submittedAt:     pred?.submittedAt ?? null,
      updatedAt:       s.updatedAt,
    };
  });

  // Tie-breaking: 1) grand final correct, 2) champion correct, 3) earlier submission
  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // 1. grand final correct
    const gfA = a.grandFinalPick ? 1 : 0;
    const gfB = b.grandFinalPick ? 1 : 0;
    if (gfB !== gfA) return gfB - gfA;
    // 2. champion correct
    const ccA = a.championCorrect ? 1 : 0;
    const ccB = b.championCorrect ? 1 : 0;
    if (ccB !== ccA) return ccB - ccA;
    // 3. earlier submission
    const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : Infinity;
    const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : Infinity;
    return ta - tb;
  });

  // Assign ranks (handle ties)
  let rank = 1;
  const ranked = rows.map((row, i) => {
    if (i > 0 && rows[i].totalScore < rows[i - 1].totalScore) rank = i + 1;
    return { rank, ...row };
  });

  return NextResponse.json({ deadlinePassed, leaderboard: ranked });
}
