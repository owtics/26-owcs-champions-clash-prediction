import { getSession } from "@/lib/auth";
import LeaderboardTable, { LeaderboardEntry } from "@/components/LeaderboardTable";
import { TOURNAMENT_NAME, PREDICTION_DEADLINE, MAX_SCORE } from "@/lib/constants";
import DeadlineBanner from "@/components/DeadlineBanner";
import { prisma } from "@/lib/prisma";

async function getLeaderboard() {
  const now = new Date();
  const deadlinePassed = now >= PREDICTION_DEADLINE;

  const scores = await prisma.score.findMany({
    include: {
      user: {
        select: {
          id:        true,
          username:  true,
          nickname:  true,
          avatarUrl: true,
          prediction: {
            select: {
              submittedAt: true,
              champion:    { select: { code: true } },
              picks: {
                where: { matchNumber: 14 },
                select: { predictedWinner: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
  });

  const rows = scores.map((s) => {
    const pred = s.user.prediction;
    return {
      userId:            s.userId,
      username:          s.user.username,
      nickname:          s.user.nickname,
      avatarUrl:         s.user.avatarUrl ?? null,
      totalScore:        s.totalScore,
      correctMatchCount: s.correctMatchCount,
      championCorrect:   s.championCorrect,
      predictedChampion: pred?.champion?.code ?? null,
      grandFinalPick:    pred?.picks?.[0]?.predictedWinner?.code ?? null,
      submittedAt:       pred?.submittedAt?.toISOString() ?? null,
      updatedAt:         s.updatedAt.toISOString(),
    };
  });

  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const gfA = a.grandFinalPick ? 1 : 0;
    const gfB = b.grandFinalPick ? 1 : 0;
    if (gfB !== gfA) return gfB - gfA;
    const ccA = a.championCorrect ? 1 : 0;
    const ccB = b.championCorrect ? 1 : 0;
    if (ccB !== ccA) return ccB - ccA;
    const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : Infinity;
    const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : Infinity;
    return ta - tb;
  });

  let rank = 1;
  const ranked: LeaderboardEntry[] = rows.map((row, i) => {
    if (i > 0 && rows[i].totalScore < rows[i - 1].totalScore) rank = i + 1;
    return { rank, ...row };
  });

  return { deadlinePassed, leaderboard: ranked };
}

export const revalidate = 30;

export default async function LeaderboardPage() {
  const session = await getSession();
  const { deadlinePassed, leaderboard } = await getLeaderboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{TOURNAMENT_NAME} — 순위표</h1>
        <p className="text-brand-subtext text-sm mt-1">
          {leaderboard.length}명 참가
        </p>
      </div>

      <DeadlineBanner />

      {!deadlinePassed && (
        <div className="bg-brand-card border border-brand-border rounded-lg px-4 py-3 text-sm text-brand-subtext">
          마감 전에는 예측 내용이 공개되지 않습니다.
        </div>
      )}

      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <LeaderboardTable
          entries={leaderboard}
          deadlinePassed={deadlinePassed}
          currentUserId={session?.user?.id}
        />
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl p-4">
        <p className="text-xs text-brand-subtext">
          <span className="font-semibold text-white">점수: </span>
          1~4경기: 5점 · 5~6경기: 5점 · 7~8경기: 6점 · 9~11경기: 8점 · 12~13경기: 10점 · 14경기: 20점
          {" | "}
          <span className="font-semibold text-white">최대 점수: {MAX_SCORE}점</span>
          {" | "}
          <span className="font-semibold text-white">동점 처리: </span>
          그랜드 파이널 예측 → 우승팀 예측 → 빠른 제출 순
        </p>
      </div>
    </div>
  );
}
