import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminResultEditor from "@/components/AdminResultEditor";
import { prisma } from "@/lib/prisma";
import { TOURNAMENT_NAME } from "@/lib/constants";
import Link from "next/link";

async function getStats() {
  const [userCount, predCount, scoreCount] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.prediction.count(),
    prisma.score.count(),
  ]);

  const topScore = await prisma.score.findFirst({
    orderBy: { totalScore: "desc" },
    include: { user: { select: { username: true } } },
  });

  return { userCount, predCount, scoreCount, topScore };
}

export default async function AdminPage() {
  const session = await getSession();

  if (!session || session.user?.role !== "ADMIN") {
    redirect("/");
  }

  const { userCount, predCount, scoreCount, topScore } = await getStats();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-gold bg-brand-gold/10 border border-brand-gold/30 px-2 py-0.5 rounded">
              관리자
            </span>
            <h1 className="text-2xl font-bold text-white">{TOURNAMENT_NAME}</h1>
          </div>
          <p className="text-brand-subtext text-sm">
            실제 경기 결과를 입력하여 점수와 순위를 업데이트하세요.
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="text-sm text-brand-accent hover:underline"
        >
          순위표 보기 →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{userCount}</div>
          <div className="text-xs text-brand-subtext mt-1">등록 사용자</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{predCount}</div>
          <div className="text-xs text-brand-subtext mt-1">제출된 예측</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{scoreCount}</div>
          <div className="text-xs text-brand-subtext mt-1">계산된 점수</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-brand-gold">
            {topScore ? `${topScore.totalScore} pts` : "—"}
          </div>
          <div className="text-xs text-brand-subtext mt-1">
            {topScore ? `1위: ${topScore.user.username}` : "아직 점수 없음"}
          </div>
        </div>
      </div>

      {/* Match result editor */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">경기 결과</h2>
        <AdminResultEditor />
      </div>

      {/* Instructions */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">안내</h2>
        <ul className="text-sm text-brand-subtext space-y-1.5 list-disc list-inside">
          <li>완료된 경기의 실제 승자를 선택하세요.</li>
          <li>이후 경기는 이전 결과를 바탕으로 자동으로 채워집니다.</li>
          <li><strong className="text-white">결과 저장</strong>을 클릭하면 저장 후 점수가 자동 재계산됩니다.</li>
          <li>토너먼트 진행에 따라 결과를 단계적으로 입력할 수 있습니다.</li>
          <li>강제로 다시 계산하려면 <strong className="text-white">점수 재계산</strong>을 사용하세요.</li>
        </ul>
      </div>
    </div>
  );
}
