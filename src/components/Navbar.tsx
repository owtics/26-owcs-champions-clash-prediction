"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { TOURNAMENT_NAME } from "@/lib/constants";

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
              <span className="text-brand-subtext">{session.user.name}</span>
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
