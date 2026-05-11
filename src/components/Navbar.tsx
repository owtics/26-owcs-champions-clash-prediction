"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { TOURNAMENT_NAME } from "@/lib/constants";

function UserAvatar({ avatarUrl, nickname }: { avatarUrl: string | null; nickname: string }) {
  const letter = (nickname || "?")[0].toUpperCase();
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={nickname}
        width={28}
        height={28}
        className="h-7 w-7 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="h-7 w-7 rounded-full bg-brand-border flex items-center justify-center flex-shrink-0">
      <span className="text-[11px] font-bold text-brand-subtext">{letter}</span>
    </div>
  );
}

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="sticky top-0 z-50 bg-brand-card border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/site/logo.png"
            alt={TOURNAMENT_NAME}
            className="h-9 w-9 object-contain"
          />
          <span className="text-white font-bold text-lg tracking-wide">
            {TOURNAMENT_NAME}
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/leaderboard" className="text-brand-subtext hover:text-white transition-colors">
            순위표
          </Link>

          {status === "loading" ? null : session ? (
            <>
              <Link href="/predict" className="text-brand-subtext hover:text-white transition-colors">
                내 예측
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="text-brand-gold hover:text-yellow-300 transition-colors">
                  관리자
                </Link>
              )}
              <span className="text-brand-subtext">|</span>
              <div className="flex items-center gap-2">
                <UserAvatar
                  avatarUrl={session.user.avatarUrl}
                  nickname={session.user.nickname || session.user.name || "?"}
                />
                <span className="text-white font-semibold">
                  {session.user.nickname || session.user.name}
                </span>
                {session.user.name && (
                  <span className="text-brand-muted text-xs">
                    ({session.user.name})
                  </span>
                )}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-brand-subtext hover:text-brand-red transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-brand-subtext hover:text-white transition-colors">
                로그인
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1 bg-brand-accent text-white rounded-md hover:bg-blue-500 transition-colors"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
