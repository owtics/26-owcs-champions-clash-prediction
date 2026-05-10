/**
 * /api/admin/results
 *
 * POST – Admin sets or updates the actual winner for one or more matches.
 *        After saving, the bracket is propagated to resolve later match teams.
 *        Score recalculation is triggered automatically.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { propagateBracket, buildPickMap, buildInitialTeams } from "@/lib/bracket";
import { recalculateAllScores } from "@/lib/scoring";

export interface ResultInput {
  matchNumber: number;
  actualWinnerCode: string;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden – admin only." }, { status: 403 });
  }

  const body = await req.json();
  const { results } = body as { results: ResultInput[] };

  if (!results || !Array.isArray(results)) {
    return NextResponse.json({ error: "Invalid results format." }, { status: 400 });
  }

  // Validate team codes
  const codes = results.map((r) => r.actualWinnerCode);
  const teams = await prisma.team.findMany({ where: { code: { in: codes } } });
  const teamMap = new Map(teams.map((t) => [t.code, t.id]));

  for (const r of results) {
    if (!teamMap.has(r.actualWinnerCode)) {
      return NextResponse.json(
        { error: `Unknown team code: ${r.actualWinnerCode}` },
        { status: 400 }
      );
    }
  }

  // Save each result
  for (const r of results) {
    await prisma.match.update({
      where: { matchNumber: r.matchNumber },
      data: { actualWinnerTeamId: teamMap.get(r.actualWinnerCode) },
    });
  }

  // ── Propagate actual bracket ────────────────────────────────────────────
  // Reload all match results, propagate, and update resolvedTeam slots.
  const allMatches = await prisma.match.findMany({
    include: { team1: true, team2: true, actualWinner: true },
    orderBy: { matchNumber: "asc" },
  });

  const seededMatches = allMatches.filter((m) => m.matchNumber <= 4);
  const initialTeams = buildInitialTeams(
    seededMatches.map((m) => ({
      matchNumber: m.matchNumber,
      team1Code:   m.team1?.code ?? null,
      team2Code:   m.team2?.code ?? null,
    }))
  );

  const pickMap = buildPickMap(
    allMatches.map((m) => ({
      matchNumber: m.matchNumber,
      winnerCode:  m.actualWinner?.code ?? null,
    }))
  );

  const bracketState = propagateBracket(pickMap, initialTeams);

  // Update resolvedTeam1 / resolvedTeam2 for all matches
  // Fetch all teams once for resolving codes → ids
  const allTeams = await prisma.team.findMany();
  const allTeamMap = new Map(allTeams.map((t) => [t.code, t.id]));

  for (const [matchNum, ms] of Array.from(bracketState)) {
    const r1 = ms.team1 ? (allTeamMap.get(ms.team1) ?? null) : null;
    const r2 = ms.team2 ? (allTeamMap.get(ms.team2) ?? null) : null;

    await prisma.match.update({
      where: { matchNumber: matchNum },
      data: { resolvedTeam1Id: r1, resolvedTeam2Id: r2 },
    });
  }

  // ── Trigger score recalculation ─────────────────────────────────────────
  await recalculateAllScores();

  return NextResponse.json({ success: true, message: "Results saved and scores updated." });
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matches = await prisma.match.findMany({
    include: { team1: true, team2: true, actualWinner: true },
    orderBy: { matchNumber: "asc" },
  });

  return NextResponse.json({ matches });
}
