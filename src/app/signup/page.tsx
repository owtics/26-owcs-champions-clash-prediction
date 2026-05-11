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
      setError("Passwords do not match.");
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
      setError(data.error ?? "Sign up failed. Please try again.");
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
          <p className="text-brand-subtext mt-1">Create an account and join the prediction</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-brand-card border border-brand-border rounded-xl p-8 space-y-5"
        >
          <h2 className="text-lg font-semibold text-white">Sign Up</h2>

          {error && (
            <div className="bg-red-500/15 border border-red-500/40 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="Letters, numbers, underscore (3–20 chars)"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              minLength={2}
              maxLength={12}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="Display name (2–12 chars)"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">Confirm Password</label>
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
            {loading ? "Creating account…" : "Sign Up"}
          </button>

          <p className="text-center text-sm text-brand-subtext">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-accent hover:underline">
              Log In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
