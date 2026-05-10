import Link from "next/link";
import { getSession } from "@/lib/auth";
import { TOURNAMENT_NAME, TOURNAMENT_DATES, PREDICTION_DEADLINE } from "@/lib/constants";
import DeadlineBanner from "@/components/DeadlineBanner";
import { prisma } from "@/lib/prisma";

async function getTopScores() {
  return prisma.score.findMany({
    take: 5,
    orderBy: { totalScore: "desc" },
    include: { user: { select: { username: true } } },
  });
}

function formatDeadlineKST() {
  return PREDICTION_DEADLINE.toLocaleString("ko-KR", {
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
  const deadlinePassed = new Date() >= PREDICTION_DEADLINE;

  const teams = [
    { seed: 1, code: "TM" },
    { seed: 2, code: "WBG" },
    { seed: 3, code: "ZETA" },
    { seed: 4, code: "DAL" },
    { seed: 5, code: "CR" },
    { seed: 6, code: "SSG" },
    { seed: 7, code: "VP" },
    { seed: 8, code: "AG" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4 py-12">
        <div className="inline-block px-3 py-1 bg-brand-accent/20 border border-brand-accent/40 rounded-full text-xs text-brand-accent font-medium tracking-widest uppercase mb-2">
          토너먼트 승부예측
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
              {deadlinePassed ? "내 예측 보기" : "승부예측 참여"}
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="px-8 py-3 bg-brand-accent hover:bg-blue-500 text-white font-bold rounded-lg text-base transition-colors"
              >
                회원가입
              </Link>
              <Link
                href="/login"
                className="px-8 py-3 bg-brand-border hover:bg-brand-border/70 text-white font-semibold rounded-lg text-base transition-colors"
              >
                로그인
              </Link>
            </>
          )}
          <Link
            href="/leaderboard"
            className="px-8 py-3 border border-brand-border hover:border-brand-subtext text-brand-subtext hover:text-white font-semibold rounded-lg text-base transition-colors"
          >
            순위표
          </Link>
        </div>
      </section>

      {/* Info grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-xl p-6">
          <h3 className="text-brand-subtext text-xs uppercase tracking-widest font-bold mb-3">
            마감일
          </h3>
          <p className="text-white font-semibold">{formatDeadlineKST()}</p>
          <p className="text-brand-subtext text-xs mt-1">
            이 시각 이후 예측이 잠깁니다. 서버에서 강제 적용됩니다.
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-xl p-6">
          <h3 className="text-brand-subtext text-xs uppercase tracking-widest font-bold mb-3">
            방식
          </h3>
          <p className="text-white font-semibold">더블 엘리미네이션</p>
          <p className="text-brand-subtext text-xs mt-1">
            14경기 · 8팀 · 승자조 &amp; 패자조
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-xl p-6">
          <h3 className="text-brand-subtext text-xs uppercase tracking-widest font-bold mb-3">
            점수
          </h3>
          <p className="text-white font-semibold">최대 35점</p>
          <p className="text-brand-subtext text-xs mt-1">
            경기당 1~5점 + 우승팀 보너스 5점
          </p>
        </div>
      </section>

      {/* Teams */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">참가 팀</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {teams.map((t) => (
            <div
              key={t.code}
              className="flex items-center gap-3 bg-brand-border/30 rounded-lg px-3 py-2.5"
            >
              <div className="w-8 h-8 rounded-md bg-brand-border flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-brand-subtext">{t.code.charAt(0)}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{t.code}</div>
                <div className="text-[10px] text-brand-muted">시드 {t.seed}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mini leaderboard */}
      {topScores.length > 0 && (
        <section className="bg-brand-card border border-brand-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">상위 예측자</h2>
            <Link href="/leaderboard" className="text-sm text-brand-accent hover:underline">
              전체 순위표 →
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
          <p className="text-brand-subtext">아직 제출된 예측이 없습니다.</p>
        </section>
      )}

      {/* Scoring explanation */}
      <section className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">점수 계산 방식</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { label: "승자조 1라운드 (1~4경기)", pts: "경기당 1점" },
            { label: "패자조 1라운드 + 승자조 준결승 + 패자조 2라운드 (5~10경기)", pts: "경기당 2점" },
            { label: "패자조 3라운드 + 승자조 결승 + 패자조 결승 (11~13경기)", pts: "경기당 3점" },
            { label: "그랜드 파이널 (14경기)", pts: "5점" },
            { label: "우승팀 정답 보너스", pts: "+5점" },
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
