"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TOURNAMENT_NAME } from "@/lib/constants";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, nickname, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "회원가입에 실패했습니다.");
      setLoading(false);
      return;
    }

    await signIn("credentials", { username, password, redirect: false });
    router.push("/predict");
    router.refresh();
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">{TOURNAMENT_NAME}</h1>
          <p className="text-brand-subtext mt-1">계정을 만들고 예측에 참여하세요</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-brand-card border border-brand-border rounded-xl p-8 space-y-5"
        >
          <h2 className="text-lg font-semibold text-white">회원가입</h2>

          {error && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="영문자, 숫자, 밑줄 3~20자"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              minLength={2}
              maxLength={12}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="한글, 영문, 숫자 2~12자"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="최소 6자 이상"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-accent hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "가입 중…" : "회원가입"}
          </button>

          <p className="text-center text-sm text-brand-subtext">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-brand-accent hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
