/**
 * /api/admin/settings
 *
 * GET  – Public. Returns the effective prediction deadline.
 * PATCH – Admin only. Updates the prediction deadline.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveDeadline } from "@/lib/deadline";

export async function GET() {
  const deadline = await getEffectiveDeadline();
  return NextResponse.json({ deadline: deadline.toISOString() });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden – admin only." }, { status: 403 });
  }

  const body = await req.json();
  const { deadline } = body as { deadline?: string };

  if (!deadline) {
    return NextResponse.json({ error: "Missing deadline value." }, { status: 400 });
  }

  const d = new Date(deadline);
  if (isNaN(d.getTime())) {
    return NextResponse.json({ error: "Invalid deadline format." }, { status: 400 });
  }

  await prisma.appSetting.upsert({
    where: { key: "predictionDeadline" },
    update: { value: d.toISOString() },
    create: { key: "predictionDeadline", value: d.toISOString() },
  });

  return NextResponse.json({ success: true, deadline: d.toISOString() });
}
