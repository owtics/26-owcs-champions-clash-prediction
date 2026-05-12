import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveDeadline } from "@/lib/deadline";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * A user is considered "submitted" when they have at least one PredictionPick row.
 * This is true even if the tournament is ongoing and no Score record exists yet.
 */
const SUBMITTED_WHERE = {
  prediction: {
    picks: { some: {} },
  },
} as const;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)),
    MAX_LIMIT
  );
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10));
  const search = url.searchParams.get("search")?.trim() ?? "";

  const now = new Date();
  const deadline = await getEffectiveDeadline();
  const deadlinePassed = now >= deadline;

  // Base: only users who have submitted picks. Search adds nickname filter on top.
  const where = search
    ? {
        AND: [
          SUBMITTED_WHERE,
          {
            nickname: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      }
    : SUBMITTED_WHERE;

  // Run three queries in parallel:
  //   1. Page of users (with optional score + prediction data)
  //   2. Filtered count  → drives hasMore
  //   3. Total submitted count (no search) → drives percentile denominator
  const [users, filteredCount, totalParticipants] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id:        true,
        username:  true,
        nickname:  true,
        avatarUrl: true,
        // score is optional — null before admin runs score calculation
        score: {
          select: {
            totalScore:        true,
            correctMatchCount: true,
            championCorrect:   true,
            updatedAt:         true,
          },
        },
        prediction: {
          select: {
            submittedAt: true,
            champion:    { select: { code: true } },
            // Only fetch the Grand Final pick (match 14) for tiebreaker
            picks: {
              where:  { matchNumber: 14 },
              select: { predictedWinner: { select: { code: true } } },
            },
          },
        },
      },
      // Order by score.totalScore (nulls last in PostgreSQL for DESC — users without
      // a score record yet appear after scored participants). Secondary: id for stability.
      orderBy: [{ score: { totalScore: "desc" } }, { id: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.user.count({ where }),
    // Global submitted count (no search filter) — always needed for percentile
    search ? prisma.user.count({ where: SUBMITTED_WHERE }) : Promise.resolve(0),
  ]);

  const rows = users.map((u) => ({
    userId:            u.id,
    username:          u.username,
    nickname:          u.nickname,
    avatarUrl:         u.avatarUrl ?? null,
    totalScore:        u.score?.totalScore        ?? 0,
    correctMatchCount: u.score?.correctMatchCount ?? 0,
    championCorrect:   u.score?.championCorrect   ?? false,
    predictedChampion: u.prediction?.champion?.code                      ?? null,
    grandFinalPick:    u.prediction?.picks?.[0]?.predictedWinner?.code   ?? null,
    submittedAt:       u.prediction?.submittedAt?.toISOString()           ?? null,
    updatedAt:         u.score?.updatedAt.toISOString()
                       ?? u.prediction?.submittedAt?.toISOString()
                       ?? new Date().toISOString(),
  }));

  // Apply full tiebreaker sort within the fetched page
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

  return NextResponse.json({
    leaderboard:       rows,
    hasMore:           offset + limit < filteredCount,
    // When search is active, use global submitted count for percentile accuracy
    totalParticipants: search ? totalParticipants : filteredCount,
    deadlinePassed,
  });
}
