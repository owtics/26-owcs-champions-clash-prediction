import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recalculateAllScores } from "@/lib/scoring";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden – admin only." }, { status: 403 });
  }

  const results = await recalculateAllScores();
  return NextResponse.json({ success: true, updated: results.length, results });
}
