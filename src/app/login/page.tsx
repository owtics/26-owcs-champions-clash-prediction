"use client";

import { useState, FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TOURNAMENT_NAME } from "@/lib/constants";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/predict";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Incorrect username or password.");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">{TOURNAMENT_NAME}</h1>
          <p className="text-brand-subtext mt-1">Join the prediction challenge</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-brand-card border border-brand-border rounded-xl p-8 space-y-5"
        >
          <h2 className="text-lg font-semibold text-white">Log In</h2>

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
              autoComplete="username"
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm text-brand-subtext mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-accent hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? "Logging in…" : "Log In"}
          </button>

          <p className="text-center text-sm text-brand-subtext">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-brand-accent hover:underline">
              Sign Up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
