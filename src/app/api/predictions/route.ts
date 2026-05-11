/**
 * /api/predictions
 *
 * GET  – Return the current user's prediction (picks + champion)
 * POST – Create or update the current user's prediction
 *
 * Server-side deadline enforcement: the deadline is checked here,
 * not only on the client, so frontend bypass is impossible.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveDeadline } from "@/lib/deadline";
import { propagateBracket, buildPickMap, buildInitialTeams } from "@/lib/bracket";

// ─── GET ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional: view another user's prediction (for /prediction/[userId] page)
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("userId") ?? session.user.id;

  // If requesting another user's data, check deadline + visibility rule
  if (targetUserId !== session.user.id) {
    const now = new Date();
    if (now < (await getEffectiveDeadline())) {
      return NextResponse.json(
        { error: "Predictions are private before the deadline." },
        { status: 403 }
      );
    }
  }

  const prediction = await prisma.prediction.findUnique({
    where: { userId: targetUserId },
    include: {
      picks: {
        include: { predictedWinner: true, predictedTeam1: true, predictedTeam2: true },
        orderBy: { matchNumber: "asc" },
      },
      champion: true,
      user: { select: { username: true } },
    },
  });

  return NextResponse.json({ prediction });
}

// ─── POST ─────────────────────────────────────────────────────────────────

export interface PickInput {
  matchNumber: number;
  predictedWinnerCode: string;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Server-side deadline check ──────────────────────────────────────────
  const now = new Date();
  if (now >= (await getEffectiveDeadline())) {
    return NextResponse.json(
      { error: "The prediction deadline has passed. Predictions are now locked." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { picks, championCode } = body as {
    picks: PickInput[];
    championCode?: string | null;
  };

  if (!picks || !Array.isArray(picks)) {
    return NextResponse.json({ error: "Invalid picks format." }, { status: 400 });
  }

  // ── Validate all teams exist ─────────────────────────────────────────────
  const allTeamCodes = Array.from(
    new Set([
      ...picks.map((p) => p.predictedWinnerCode),
      ...(championCode ? [championCode] : []),
    ])
  );

  const teams = await prisma.team.findMany({
    where: { code: { in: allTeamCodes } },
  });
  const teamMap = new Map(teams.map((t) => [t.code, t.id]));

  for (const code of allTeamCodes) {
    if (!teamMap.has(code)) {
      return NextResponse.json({ error: `Unknown team code: ${code}` }, { status: 400 });
    }
  }

  // ── Load seeded matches and propagate bracket ────────────────────────────
  const seededMatches = await prisma.match.findMany({
    where: { matchNumber: { in: [1, 2, 3, 4] } },
    include: { team1: true, team2: true },
  });

  const initialTeams = buildInitialTeams(
    seededMatches.map((m) => ({
      matchNumber: m.matchNumber,
      team1Code:   m.team1?.code ?? null,
      team2Code:   m.team2?.code ?? null,
    }))
  );

  const pickMap = buildPickMap(
    picks.map((p) => ({ matchNumber: p.matchNumber, winnerCode: p.predictedWinnerCode }))
  );

  const bracketState = propagateBracket(pickMap, initialTeams);

  // ── Validate each pick against the propagated bracket ───────────────────
  for (const pick of picks) {
    const ms = bracketState.get(pick.matchNumber);
    if (!ms) {
      return NextResponse.json(
        { error: `Invalid match number: ${pick.matchNumber}` },
        { status: 400 }
      );
    }
    const validTeams = [ms.team1, ms.team2].filter(Boolean) as string[];
    if (!validTeams.includes(pick.predictedWinnerCode)) {
      return NextResponse.json(
        {
          error: `Match ${pick.matchNumber}: ${pick.predictedWinnerCode} is not a valid team for this match.`,
        },
        { status: 400 }
      );
    }
  }

  // ── Upsert Prediction and PredictionPicks ────────────────────────────────
  const userId = session.user.id;

  const prediction = await prisma.prediction.upsert({
    where: { userId },
    update: {
      championTeamId: championCode ? (teamMap.get(championCode) ?? null) : null,
    },
    create: {
      userId,
      championTeamId: championCode ? (teamMap.get(championCode) ?? null) : null,
    },
  });

  // Delete existing picks and recreate (simpler than diff)
  await prisma.predictionPick.deleteMany({ where: { predictionId: prediction.id } });

  await prisma.predictionPick.createMany({
    data: picks.map((p) => {
      const ms = bracketState.get(p.matchNumber)!;
      return {
        predictionId:          prediction.id,
        matchNumber:           p.matchNumber,
        predictedTeam1Id:      ms.team1 ? (teamMap.get(ms.team1) ?? null) : null,
        predictedTeam2Id:      ms.team2 ? (teamMap.get(ms.team2) ?? null) : null,
        predictedWinnerTeamId: teamMap.get(p.predictedWinnerCode) ?? null,
      };
    }),
  });

  return NextResponse.json({ success: true, predictionId: prediction.id });
}
