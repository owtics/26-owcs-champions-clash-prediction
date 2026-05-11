import Link from "next/link";
import { getSession } from "@/lib/auth";
import { TOURNAMENT_NAME, TOURNAMENT_DATES } from "@/lib/constants";
import { getEffectiveDeadline } from "@/lib/deadline";
import DeadlineBanner from "@/components/DeadlineBanner";
import { prisma } from "@/lib/prisma";

async function getTopScores() {
  return prisma.score.findMany({
    take: 5,
    orderBy: { totalScore: "desc" },
    include: { user: { select: { username: true } } },
  });
}

async function formatDeadlineKST() {
  const deadline = await getEffectiveDeadline();
  return deadline.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

export default async function HomePage() {
  const session = await getSession();
  const topScores = await getTopScores();
  const deadline = await getEffectiveDeadline();
  const deadlinePassed = new Date() >= deadline;

  const teams = [
    { seed: 1, code: "TM",   logoUrl: "/logos/teams/tm.png"   },
    { seed: 2, code: "WBG",  logoUrl: "/logos/teams/wbg.png"  },
    { seed: 3, code: "ZETA", logoUrl: "/logos/teams/zeta.png" },
    { seed: 4, code: "DAL",  logoUrl: "/logos/teams/dal.png"  },
    { seed: 5, code: "CR",   logoUrl: "/logos/teams/cr.png"   },
    { seed: 6, code: "SSG",  logoUrl: "/logos/teams/ssg.png"  },
    { seed: 7, code: "VP",   logoUrl: "/logos/teams/vp.png"   },
    { seed: 8, code: "AG",   logoUrl: "/logos/teams/ag.png"   },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4 py-12">
        {/* Tournament logo — renders only if file exists; browser silently hides on 404 */}
        {/* Place your image at: public/logos/tournament/champions-clash.png */}
        <div className="flex justify-center mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/tournament/champions-clash.png"
            alt={TOURNAMENT_NAME}
            className="h-28 sm:h-36 w-auto object-contain drop-shadow-[0_0_18px_rgba(59,130,246,0.35)]"
          />
        </div>
        <div className="inline-block px-3 py-1 bg-brand-accent/20 border border-brand-accent/40 rounded-full text-xs text-brand-accent font-medium tracking-widest uppercase mb-2">
          Tournament Prediction
        </div>
        <h1 className="text-5xl font-extrabold text-white tracking-tight">
          {TOURNAMENT_NAME}
        </h1>
        <p className="text-brand-subtext text-lg">{TOURNAMENT_DATES}</p>

        <div className="max-w-md mx-auto mt-4">
          <DeadlineBanner />
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          {session ? (
            <Link
              href="/predict"
              className="px-8 py-3 bg-brand-accent hover:bg-blue-500 text-white font-bold rounded-lg text-base transition-colors"
            >
              {deadlinePassed ? "View My Prediction" : "Make a Prediction"}
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="px-8 py-3 bg-brand-accent hover:bg-blue-500 text-white font-bold rounded-lg text-base transition-colors"
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 bg-brand-border hover:bg-brand-border/70 text-white font-semibold rounded-lg text-base transition-colors"
              >
                Log In
              </Link>
            </>
          )}
          <Link
            href="/leaderboard"
            className="px-8 py-3 border border-brand-border hover:border-brand-subtext text-brand-subtext hover:text-white font-semibold rounded-lg text-base transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </section>

      {/* Info grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-xl p-6">
          <h3 className="text-brand-subtext text-xs uppercase tracking-widest font-bold mb-3">
            Deadline
          </h3>
          <p className="text-white font-semibold">{await formatDeadlineKST()}</p>
          <p className="text-brand-subtext text-xs mt-1">
            Predictions lock after this time. Enforced server-side.
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-xl p-6">
          <h3 className="text-brand-subtext text-xs uppercase tracking-widest font-bold mb-3">
            Format
          </h3>
          <p className="text-white font-semibold">Double Elimination</p>
          <p className="text-brand-subtext text-xs mt-1">
            14 matches · 8 teams · Winners &amp; Losers bracket
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-xl p-6">
          <h3 className="text-brand-subtext text-xs uppercase tracking-widest font-bold mb-3">
            Scoring
          </h3>
          <p className="text-white font-semibold">Max 106 pts</p>
          <p className="text-brand-subtext text-xs mt-1">
            5–20 pts per match depending on round
          </p>
        </div>
      </section>

      {/* Teams */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Participating Teams</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {teams.map((t) => (
            <div
              key={t.code}
              className="flex items-center gap-3 bg-brand-border/30 rounded-lg px-3 py-2.5"
            >
              <div className="w-8 h-8 rounded-md bg-brand-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.logoUrl}
                  alt={t.code}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{t.code}</div>
                <div className="text-[10px] text-brand-muted">Seed {t.seed}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mini leaderboard */}
      {topScores.length > 0 && (
        <section className="bg-brand-card border border-brand-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Top Predictors</h2>
            <Link href="/leaderboard" className="text-sm text-brand-accent hover:underline">
              Full Leaderboard →
            </Link>
          </div>
          <div className="space-y-2">
            {topScores.map((s, i) => (
              <div
                key={s.userId}
                className="flex items-center justify-between py-2 border-b border-brand-border/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold w-6 ${i === 0 ? "text-brand-gold" : "text-brand-subtext"}`}>
                    {i + 1}
                  </span>
                  <span className="text-white font-medium">{s.user.username}</span>
                </div>
                <span className="font-bold text-white">{s.totalScore} pts</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {topScores.length === 0 && (
        <section className="bg-brand-card border border-brand-border rounded-xl p-6 text-center">
          <p className="text-brand-subtext">No predictions submitted yet.</p>
        </section>
      )}

      {/* Scoring explanation */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Scoring System</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: "WB Round 1 (M1–4)", pts: "5 pts each" },
            { label: "LB Round 1 (M5–6)", pts: "5 pts each" },
            { label: "WB Semifinals (M7–8)", pts: "6 pts each" },
            { label: "LB Round 2–3 (M9–11)", pts: "8 pts each" },
            { label: "WB Final / LB Final (M12–13)", pts: "10 pts each" },
            { label: "Grand Final (M14)", pts: "20 pts" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between items-center bg-brand-border/20 rounded-lg px-4 py-2.5"
            >
              <span className="text-brand-subtext">{row.label}</span>
              <span className="font-bold text-brand-accent">{row.pts}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
