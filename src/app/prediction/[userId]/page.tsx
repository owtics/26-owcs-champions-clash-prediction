import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PREDICTION_DEADLINE, PREDICTIONS_PUBLIC_AFTER_DEADLINE } from "@/lib/constants";
import Bracket, { BracketMatch, PickMap } from "@/components/Bracket";
import DeadlineBanner from "@/components/DeadlineBanner";
import Link from "next/link";

interface Props {
  params: Promise<{ userId: string }>;
}

async function getData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id:       true,
      username: true,
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

  return user;
}

export default async function PredictionViewPage({ params }: Props) {
  const { userId } = await params;
  const session    = await getSession();
  const now        = new Date();
  const deadlinePassed = now >= PREDICTION_DEADLINE;

  const isOwn = session?.user?.id === userId;

  // Enforce visibility rules
  if (!isOwn) {
    if (!deadlinePassed || !PREDICTIONS_PUBLIC_AFTER_DEADLINE) {
      if (!session) redirect("/login");
      // Show an "not yet visible" page
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-3">
            <p className="text-brand-subtext text-lg">
              아직 예측이 공개되지 않았습니다.
            </p>
            <p className="text-brand-muted text-sm">
              마감 후 확인해 주세요.
            </p>
            <Link href="/leaderboard" className="text-brand-accent hover:underline text-sm">
              순위표 보기 →
            </Link>
          </div>
        </div>
      );
    }
  }

  const userData = await getData(userId);
  if (!userData) notFound();

  const matches = await prisma.match.findMany({
    include: { team1: true, team2: true, actualWinner: true },
    orderBy: { matchNumber: "asc" },
  });

  // Build picks map
  const picks: PickMap = {};
  for (const pick of userData.prediction?.picks ?? []) {
    if (pick.predictedWinner?.code) {
      picks[pick.matchNumber] = pick.predictedWinner.code;
    }
  }

  // Build correctness map (from isCorrect on picks)
  const correctPicks: Record<number, boolean | null> = {};
  for (const pick of userData.prediction?.picks ?? []) {
    correctPicks[pick.matchNumber] = pick.isCorrect ?? null;
  }

  const bracketMatches: BracketMatch[] = matches.map((m) => ({
    matchNumber:     m.matchNumber,
    roundName:       m.roundName,
    bracketType:     m.bracketType,
    team1:           m.team1 ? { code: m.team1.code, seed: m.team1.seed } : null,
    team2:           m.team2 ? { code: m.team2.code, seed: m.team2.seed } : null,
    actualWinnerCode: m.actualWinner?.code ?? null,
  }));

  const champion    = userData.prediction?.champion?.code ?? null;
  const score       = userData.score;
  const submittedAt = userData.prediction?.submittedAt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isOwn ? "내" : `${userData.username}의`} 예측
          </h1>
          {submittedAt && (
            <p className="text-brand-subtext text-sm mt-0.5">
              제출:{" "}
              {new Date(submittedAt).toLocaleString("en-US", {
                timeZone: "Asia/Seoul",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {champion && (
            <div className="flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-3 py-2">
              <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold">
                예측 우승팀
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
                points
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
            <div className="text-xs text-brand-subtext mt-1">총점</div>
          </div>
          <div className="bg-brand-card border border-brand-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{score.correctMatchCount}</div>
            <div className="text-xs text-brand-subtext mt-1">적중 경기</div>
          </div>
          <div className="bg-brand-card border border-brand-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${score.championCorrect ? "text-green-400" : "text-brand-muted"}`}>
              {score.championCorrect ? "✓" : "✗"}
            </div>
            <div className="text-xs text-brand-subtext mt-1">우승팀 정답</div>
          </div>
        </div>
      )}

      {/* Read-only bracket */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <Bracket
          matches={bracketMatches}
          picks={picks}
          disabled
          showResults={deadlinePassed}
          correctPicks={correctPicks}
        />
      </div>

      {isOwn && !deadlinePassed && (
        <div className="text-center">
          <Link
            href="/predict"
            className="text-brand-accent hover:underline text-sm"
          >
            ← 예측 수정하기
          </Link>
        </div>
      )}
    </div>
  );
}
