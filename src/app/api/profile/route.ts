/**
 * GET    /api/profile  — returns the logged-in user's editable profile fields
 * PATCH  /api/profile  — updates nickname and/or isPredictionPublic
 * DELETE /api/profile  — permanently deletes the current user's account
 *
 * Only the authenticated user can read/edit/delete their own profile.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const NICKNAME_RE = /^[a-zA-Z0-9_\uAC00-\uD7A3]+$/;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nickname: true, avatarUrl: true, isPredictionPublic: true },
  });

  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json() as {
    nickname?: string;
    isPredictionPublic?: boolean;
  };

  const data: { nickname?: string; isPredictionPublic?: boolean } = {};

  if (body.nickname !== undefined) {
    const trimmed = body.nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 12) {
      return NextResponse.json(
        { error: "Nickname must be 2–12 characters." },
        { status: 400 }
      );
    }
    if (!NICKNAME_RE.test(trimmed)) {
      return NextResponse.json(
        { error: "Nickname may only contain Korean, English, numbers, or underscores." },
        { status: 400 }
      );
    }
    data.nickname = trimmed;
  }

  if (body.isPredictionPublic !== undefined) {
    if (typeof body.isPredictionPublic !== "boolean") {
      return NextResponse.json({ error: "isPredictionPublic must be a boolean." }, { status: 400 });
    }
    data.isPredictionPublic = body.isPredictionPublic;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  if (data.nickname) {
    const existingNickname = await prisma.user.findFirst({
      where: { nickname: data.nickname, NOT: { id: session.user.id } },
    });
    if (existingNickname) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { nickname: true, avatarUrl: true, isPredictionPublic: true },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    // P2002 = unique constraint violation (race between check and write)
    if (
      typeof e === "object" && e !== null &&
      "code" in e && (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (session.user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admin accounts cannot be deleted from profile settings." },
      { status: 403 }
    );
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.predictionPick.deleteMany({
      where: { prediction: { userId } },
    }),
    prisma.prediction.deleteMany({ where: { userId } }),
    prisma.score.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return NextResponse.json({ success: true });
}
