import { getSession } from "@/lib/auth";
import { MAX_SCORE } from "@/lib/constants";
import DeadlineBanner from "@/components/DeadlineBanner";
import LeaderboardClient from "@/components/LeaderboardClient";

// Always server-render so session is fresh; data fetching happens client-side
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
      </div>

      <DeadlineBanner />

      <LeaderboardClient currentUserId={session?.user?.id} />

      <div className="bg-brand-card border border-brand-border rounded-xl p-4">
        <p className="text-xs text-brand-subtext">
          <span className="font-semibold text-white">Scoring: </span>
          M1–4: 5pts · M5–6: 5pts · M7–8: 6pts · M9–11: 8pts · M12–13: 10pts · M14: 20pts
          {" | "}
          <span className="font-semibold text-white">Max: {MAX_SCORE}pts</span>
          {" | "}
          <span className="font-semibold text-white">Tiebreaker: </span>
          Grand Final pick → Champion pick → Earlier submission
        </p>
      </div>
    </div>
  );
}
