import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminResultEditor from "@/components/AdminResultEditor";
import AdminDeadlineControl from "@/components/AdminDeadlineControl";
import { prisma } from "@/lib/prisma";
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
              Admin
            </span>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          </div>
          <p className="text-brand-subtext text-sm">
            Enter match results to update scores and rankings.
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="text-sm text-brand-accent hover:underline"
        >
          View Leaderboard →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{userCount}</div>
          <div className="text-xs text-brand-subtext mt-1">Registered Users</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{predCount}</div>
          <div className="text-xs text-brand-subtext mt-1">Predictions Submitted</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{scoreCount}</div>
          <div className="text-xs text-brand-subtext mt-1">Scores Calculated</div>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-xl p-4">
          <div className="text-2xl font-bold text-brand-gold">
            {topScore ? `${topScore.totalScore} pts` : "—"}
          </div>
          <div className="text-xs text-brand-subtext mt-1">
            {topScore ? `#1: ${topScore.user.username}` : "No scores yet"}
          </div>
        </div>
      </div>

      {/* Prediction deadline control */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Prediction Deadline</h2>
        <AdminDeadlineControl />
      </div>

      {/* Match result editor */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-6">Match Results</h2>
        <AdminResultEditor />
      </div>

      {/* Instructions */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Instructions</h2>
        <ul className="text-sm text-brand-subtext space-y-1.5 list-disc list-inside">
          <li>Select the actual winner for each completed match.</li>
          <li>Later matches will be auto-populated based on prior results.</li>
          <li>Clicking <strong className="text-white">Save Results</strong> saves and automatically recalculates scores.</li>
          <li>You can enter results incrementally as the tournament progresses.</li>
          <li>Use <strong className="text-white">Recalculate Scores</strong> to force a recalculation at any time.</li>
        </ul>
      </div>
    </div>
  );
}
