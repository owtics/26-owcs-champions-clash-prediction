/**
 * PATCH /api/profile/avatar
 *
 * Authenticated user only. Updates the logged-in user's avatarUrl.
 * Only URLs from ALLOWED_AVATARS are accepted.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALLOWED_AVATARS } from "@/lib/avatars";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json();
  const { avatarUrl } = body as { avatarUrl?: string };

  if (!avatarUrl) {
    return NextResponse.json({ error: "Missing avatarUrl." }, { status: 400 });
  }

  // Server-side allowlist validation — no arbitrary external URLs accepted.
  if (!(ALLOWED_AVATARS as readonly string[]).includes(avatarUrl)) {
    return NextResponse.json({ error: "Invalid avatar selection." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ success: true, avatarUrl });
}
