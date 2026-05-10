/**
 * /api/matches – Returns all matches with their current teams and actual results.
 * Used by the bracket UI and admin panel.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const matches = await prisma.match.findMany({
    include: {
      team1: true,
      team2: true,
      actualWinner: true,
    },
    orderBy: { matchNumber: "asc" },
  });

  return NextResponse.json({ matches });
}
