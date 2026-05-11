import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PREDICTION_DEADLINE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30_000;
let cachedPayload: string | null = null;
let cacheExpiresAt = 0;

export async function GET() {
  const nowMs = Date.now();

  if (cachedPayload && nowMs < cacheExpiresAt) {
    return new NextResponse(cachedPayload, {
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const deadlinePassed = now >= PREDICTION_DEADLINE;

  const scores = await prisma.score.findMany({
    include: {
      user: {
        select: {
          id:        true,
          username:  true,
          nickname:  true,
          avatarUrl: true,
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
    orderBy: [{ totalScore: "desc" }],
  });

  const rows = scores.map((s) => {
    const pred = s.user.prediction;
    return {
      userId:            s.userId,
      username:          s.user.username,
      nickname:          s.user.nickname,
      avatarUrl:         s.user.avatarUrl ?? null,
      totalScore:        s.totalScore,
      correctMatchCount: s.correctMatchCount,
      championCorrect:   s.championCorrect,
      predictedChampion: pred?.champion?.code ?? null,
      grandFinalPick:    pred?.picks?.[0]?.predictedWinner?.code ?? null,
      submittedAt:       pred?.submittedAt ?? null,
      updatedAt:         s.updatedAt,
    };
  });

  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const gfA = a.grandFinalPick ? 1 : 0;
    const gfB = b.grandFinalPick ? 1 : 0;
    if (gfB !== gfA) return gfB - gfA;
    const ccA = a.championCorrect ? 1 : 0;
    const ccB = b.championCorrect ? 1 : 0;
    if (ccB !== ccA) return ccB - ccA;
    const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : Infinity;
    const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : Infinity;
    return ta - tb;
  });

  let rank = 1;
  const ranked = rows.map((row, i) => {
    if (i > 0 && rows[i].totalScore < rows[i - 1].totalScore) rank = i + 1;
    return { rank, ...row };
  });

  const responseBody = JSON.stringify({ deadlinePassed, leaderboard: ranked });
  cachedPayload = responseBody;
  cacheExpiresAt = nowMs + CACHE_TTL_MS;

  return new NextResponse(responseBody, {
    headers: { "Content-Type": "application/json" },
  });
}
