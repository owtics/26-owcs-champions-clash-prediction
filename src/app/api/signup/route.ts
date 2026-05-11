import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const PASSWORD_MAX_LENGTH = 72;

const AVATAR_URLS = [
  "/avatars/avatar-1.png",
  "/avatars/avatar-2.png",
  "/avatars/avatar-3.png",
  "/avatars/avatar-4.png",
  "/avatars/avatar-5.png",
  "/avatars/avatar-6.png",
];

function randomAvatar(): string {
  return AVATAR_URLS[Math.floor(Math.random() * AVATAR_URLS.length)];
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`signup:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const body = await req.json();
  const { username, nickname, password } = body as {
    username?: string;
    nickname?: string;
    password?: string;
  };

  if (!username || !nickname || !password) {
    return NextResponse.json({ error: "모든 필드를 입력해 주세요." }, { status: 400 });
  }

  // Validate username
  if (username.length < 3 || username.length > 20) {
    return NextResponse.json({ error: "아이디는 3~20자여야 합니다." }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: "아이디는 영문자, 숫자, 밑줄(_)만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  // Validate nickname
  if (nickname.length < 2 || nickname.length > 12) {
    return NextResponse.json({ error: "닉네임은 2~12자여야 합니다." }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_\uAC00-\uD7A3]+$/.test(nickname)) {
    return NextResponse.json(
      { error: "닉네임은 한글, 영문자, 숫자, 밑줄(_)만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  // Validate password
  if (password.length < 6) {
    return NextResponse.json(
      { error: "비밀번호는 최소 6자 이상이어야 합니다." },
      { status: 400 }
    );
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return NextResponse.json(
      { error: `비밀번호는 최대 ${PASSWORD_MAX_LENGTH}자까지 입력할 수 있습니다.` },
      { status: 400 }
    );
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const avatarUrl    = randomAvatar();

  const user = await prisma.user.create({
    data: { username, nickname, passwordHash, avatarUrl, role: "USER" },
    select: { id: true, username: true, nickname: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
