import Link from "next/link";
import { getSession } from "@/lib/auth";
import { TOURNAMENT_NAME, TOURNAMENT_DATES } from "@/lib/constants";
import { getEffectiveDeadline } from "@/lib/deadline";
import DeadlineBanner from "@/components/DeadlineBanner";
import { prisma } from "@/lib/prisma";

// ─── Team external links ───────────────────────────────────────────────────
// Edit these URLs to point to each team's official page.
const TEAM_LINKS: Record<string, string> = {
  TM:   "https://owtics.gg/en-US/esports/team/twisted-minds",
  WBG:  "https://owtics.gg/en-US/esports/team/weibo-gaming",
  ZETA: "https://owtics.gg/en-US/esports/team/zeta-division",
  DAL:  "https://owtics.gg/en-US/esports/team/dallas-fuel",
  CR:   "https://owtics.gg/en-US/esports/team/crazy-raccoon",
  SSG:  "https://owtics.gg/en-US/esports/team/spacestation-gaming",
  VP:   "https://owtics.gg/en-US/esports/team/virtuspro",
  AG:   "https://owtics.gg/en-US/esports/team/all-gamers",
};

// ─── Community Gallery ─────────────────────────────────────────────────────
// Add or remove src paths here. Titles are derived automatically from filenames.
const GALLERY_IMAGES = [
  "/gallery/고양이와 저격수.png",
  "/gallery/관측 안된 프라우드.png",
  "/gallery/괴짜가족.png",
  "/gallery/동학 출전의 대한 이해와 고찰.png",
  "/gallery/따봉하쿠.png",
  "/gallery/명제의 복수.png",
  "/gallery/바퀴올렛.png",
  "/gallery/변종.png",
  "/gallery/아들과 엄마.png",
  "/gallery/알을못깬프라우드.png",
  "/gallery/야만냥이의 여행.png",
  "/gallery/좋아 대나무 헬리콥터~.png",
  "/gallery/태양만세.png",
  "/gallery/티원의 범인.png",
  "/gallery/GOAT.png",
  "/gallery/따봉선준.png",
  "/gallery/질　주　선　준.png",
  "/gallery/조별딱.png",
  "/gallery/여신.png",
  "/gallery/아앗....png",
  "/gallery/대머리망토.png",
  "/gallery/이예이 대회다~.png",
  "/gallery/기모링마스크.png",
  "/gallery/천상천하유아독존.png",
];

/** Derive a display title from an image src path.
 *  Strips the directory prefix and extension, then replaces underscores/hyphens with spaces.
 *  Examples:
 *    "/gallery/grand_final_banner.png" → "grand final banner"
 *    "/gallery/Team-Poster-FNC.webp"   → "Team Poster FNC"
 *    "/gallery/태양만세.png"           → "태양만세"
 */
function getGalleryTitle(src: string): string {
  const filename = src.split("/").pop() ?? src;
  const noExt    = filename.replace(/\.(png|jpe?g|webp)$/i, "");
  return noExt.replace(/[_-]+/g, " ");
}

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
            className="h-28 sm:h-80 w-auto drop-shadow-[0_0_18px_rgba(59,130,246,0.35)]"
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
          {teams.map((t) => {
            const href = TEAM_LINKS[t.code];
            const inner = (
              <>
                <div className="w-8 h-8 rounded-md bg-brand-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.logoUrl} alt={t.code} className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{t.code}</div>
                  <div className="text-[10px] text-brand-muted">Seed {t.seed}</div>
                </div>
              </>
            );
            if (href) {
              return (
                <a
                  key={t.code}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-brand-border/30 hover:bg-brand-border/60 hover:scale-[1.03] hover:border-brand-accent/50 border border-transparent rounded-lg px-3 py-2.5 transition-all duration-150"
                >
                  {inner}
                </a>
              );
            }
            return (
              <div key={t.code} className="flex items-center gap-3 bg-brand-border/30 rounded-lg px-3 py-2.5 border border-transparent">
                {inner}
              </div>
            );
          })}
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

      {/* Community Gallery */}
      {GALLERY_IMAGES.length > 0 && (
        <section className="bg-brand-card border border-brand-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Community Gallery</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {GALLERY_IMAGES.map((src) => {
              const title = getGalleryTitle(src);
              return (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-lg overflow-hidden border border-brand-border/50 hover:border-brand-accent/50 hover:shadow-[0_0_8px_rgba(59,130,246,0.25)] transition-all duration-150"
              >
                <div className="aspect-square overflow-hidden bg-brand-border/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="px-2 py-1.5 bg-brand-border/10">
                  <p className="text-[10px] text-brand-subtext text-center truncate">{title}</p>
                </div>
              </a>
              );
            })}
          </div>
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
