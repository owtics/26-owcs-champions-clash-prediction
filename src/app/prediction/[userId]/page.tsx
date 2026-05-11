import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_SCORE, MATCH_POINTS } from "@/lib/constants";
import { getEffectiveDeadline } from "@/lib/deadline";
import BracketViewer from "@/components/BracketViewer";
import { BracketMatch, PickMap } from "@/components/Bracket";
import DeadlineBanner from "@/components/DeadlineBanner";
import Link from "next/link";

interface Props {
  params: Promise<{ userId: string }>;
}

async function getData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id:                 true,
      username:           true,
      nickname:           true,
      avatarUrl:          true,
      isPredictionPublic: true,
      prediction: {
        include: {
          picks: {
            include: { predictedWinner: true, predictedTeam1: true, predictedTeam2: true },
            orderBy: { matchNumber: "asc" },
          },
          champion: true,
        },
      },
      score: true,
    },
  });
}

export default async function PredictionViewPage({ params }: Props) {
  const { userId }     = await params;
  const session        = await getSession();
  const now            = new Date();
  const deadline       = await getEffectiveDeadline();
  const deadlinePassed = now >= deadline;
  const isOwn          = session?.user?.id === userId;
  const isAdmin        = session?.user?.role === "ADMIN";

  const userData = await getData(userId);
  if (!userData) notFound();

  // ── Privacy enforcement ────────────────────────────────────────────────────
  // Only explicit `false` blocks. null/undefined/true → public (default).
  const isPrivate = userData.isPredictionPublic === false;

  if (process.env.NODE_ENV !== "production") {
    console.log("[PredictionViewPage] access check", {
      targetUserId:       userId,
      viewerUserId:       session?.user?.id,
      isOwn,
      isAdmin,
      isPredictionPublic: userData.isPredictionPublic,
      isPrivate,
      blocked:            isPrivate && !isOwn && !isAdmin,
    });
  }

  if (isPrivate && !isOwn && !isAdmin) {
    // Unauthenticated users → send to login so they can try as owner/admin.
    if (!session) redirect(`/login?callbackUrl=/prediction/${userId}`);

    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <p className="text-brand-subtext text-lg">This prediction profile is private.</p>
          <Link href="/leaderboard" className="text-brand-accent hover:underline text-sm">
            View Leaderboard →
          </Link>
        </div>
      </div>
    );
  }

  const matches = await prisma.match.findMany({
    include: { team1: true, team2: true, actualWinner: true },
    orderBy: { matchNumber: "asc" },
  });

  // Build actual winner lookup (matchNumber → code) for fallback calculation
  const actualWinnerCodeByMatch: Record<number, string | null> = {};
  for (const m of matches) {
    actualWinnerCodeByMatch[m.matchNumber] = m.actualWinner?.code ?? null;
  }

  // Build picks map
  const picks: PickMap = {};
  for (const pick of userData.prediction?.picks ?? []) {
    if (pick.predictedWinner?.code) {
      picks[pick.matchNumber] = pick.predictedWinner.code;
    }
  }

  // Build correctness map — use stored isCorrect when available, otherwise
  // derive from predicted vs actual winner code so results show immediately
  // even if recalculate hasn't been run yet.
  const correctPicks: Record<number, boolean | null> = {};
  for (const pick of userData.prediction?.picks ?? []) {
    if (pick.isCorrect !== null && pick.isCorrect !== undefined) {
      correctPicks[pick.matchNumber] = pick.isCorrect;
    } else {
      const actualCode = actualWinnerCodeByMatch[pick.matchNumber];
      if (actualCode !== null && actualCode !== undefined) {
        correctPicks[pick.matchNumber] = pick.predictedWinner?.code === actualCode;
      } else {
        correctPicks[pick.matchNumber] = null; // pending — no result yet
      }
    }
  }

  // Build per-match points map — use stored pointsAwarded when scoring has run
  // (isCorrect is non-null), otherwise derive from MATCH_POINTS as fallback.
  const pickPoints: Record<number, number> = {};
  for (const pick of userData.prediction?.picks ?? []) {
    if (pick.isCorrect !== null && pick.isCorrect !== undefined) {
      pickPoints[pick.matchNumber] = pick.pointsAwarded;
    } else {
      const correct = correctPicks[pick.matchNumber];
      pickPoints[pick.matchNumber] = correct === true ? (MATCH_POINTS[pick.matchNumber] ?? 0) : 0;
    }
  }

  const bracketMatches: BracketMatch[] = matches.map((m) => ({
    matchNumber:      m.matchNumber,
    roundName:        m.roundName,
    bracketType:      m.bracketType,
    team1:            m.team1 ? { code: m.team1.code, seed: m.team1.seed, logoUrl: m.team1.logoUrl } : null,
    team2:            m.team2 ? { code: m.team2.code, seed: m.team2.seed, logoUrl: m.team2.logoUrl } : null,
    actualWinnerCode: m.actualWinner?.code ?? null,
  }));

  const teamSeeds: Record<string, number | null> = {};
  const teamLogos: Record<string, string | null> = {};
  for (const m of matches) {
    if (m.team1) { teamSeeds[m.team1.code] = m.team1.seed; teamLogos[m.team1.code] = m.team1.logoUrl; }
    if (m.team2) { teamSeeds[m.team2.code] = m.team2.seed; teamLogos[m.team2.code] = m.team2.logoUrl; }
  }

  const champion    = userData.prediction?.champion?.code ?? null;
  const score       = userData.score;
  const submittedAt = userData.prediction?.submittedAt;

  const displayNickname = userData.nickname || userData.username;
  const avatarUrl       = userData.avatarUrl ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayNickname}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-brand-border flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-brand-subtext">
                {displayNickname[0].toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isOwn ? "My Prediction" : (
                <>
                  <span className="text-white">{displayNickname}</span>
                  {userData.nickname && (
                    <span className="text-brand-muted text-base font-normal ml-1">
                      ({userData.username})
                    </span>
                  )}
                  {"'s Prediction"}
                </>
              )}
            </h1>
            {submittedAt && (
              <p className="text-brand-subtext text-sm mt-0.5">
                Submitted:{" "}
                {new Date(submittedAt).toLocaleString("en-US", {
                  timeZone: "Asia/Seoul",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {champion && (
            <div className="flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-3 py-2">
              <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold">
                Predicted Champion
              </span>
              <span className="text-brand-gold font-bold">{champion}</span>
              {score?.championCorrect && (
                <span className="text-green-400 text-xs">✓</span>
              )}
            </div>
          )}

          {score && (
            <div className="bg-brand-card border border-brand-border rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-extrabold text-white">{score.totalScore}</div>
              <div className="text-[10px] text-brand-subtext uppercase tracking-widest">
                / {MAX_SCORE}점
              </div>
            </div>
          )}
        </div>
      </div>

      <DeadlineBanner />

      {/* Score summary */}
      {score && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-brand-card border border-brand-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{score.totalScore}</div>
            <div className="text-xs text-brand-subtext mt-1">Total / {MAX_SCORE}pts</div>
          </div>
          <div className="bg-brand-card border border-brand-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{score.correctMatchCount}</div>
            <div className="text-xs text-brand-subtext mt-1">Correct Matches</div>
          </div>
          <div className="bg-brand-card border border-brand-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${score.championCorrect ? "text-green-400" : "text-brand-muted"}`}>
              {score.championCorrect ? "✓" : "✗"}
            </div>
            <div className="text-xs text-brand-subtext mt-1">Champion Correct</div>
          </div>
        </div>
      )}

      {/* Bracket with expand */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <BracketViewer
          matches={bracketMatches}
          picks={picks}
          disabled
          showResults
          correctPicks={correctPicks}
          pickPoints={pickPoints}
          teamSeeds={teamSeeds}
          teamLogos={teamLogos}
        />
      </div>

      {isOwn && !deadlinePassed && (
        <div className="text-center">
          <Link href="/predict" className="text-brand-accent hover:underline text-sm">
            ← Edit My Prediction
          </Link>
        </div>
      )}
    </div>
  );
}
