import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

// bcrypt safely handles at most 72 bytes; longer inputs waste CPU with no benefit.
const PASSWORD_MAX_LENGTH = 72;

export async function POST(req: NextRequest) {
  // Rate limit: 5 signups per IP per minute.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`signup:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      }
    );
  }

  const body = await req.json();
  const { username, password } = body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: "모든 필드를 입력해 주세요." }, { status: 400 });
  }

  if (username.length < 3 || username.length > 20) {
    return NextResponse.json(
      { error: "아이디는 3~20자여야 합니다." },
      { status: 400 }
    );
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return NextResponse.json(
      { error: "아이디는 영문자, 숫자, 밑줄(_)만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

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

  const user = await prisma.user.create({
    data: { username, passwordHash, role: "USER" },
    select: { id: true, username: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
