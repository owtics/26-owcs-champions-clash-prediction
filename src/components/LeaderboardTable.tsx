"use client";

import Link from "next/link";
import { PREDICTIONS_PUBLIC_AFTER_DEADLINE } from "@/lib/constants";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  totalScore: number;
  correctMatchCount: number;
  championCorrect: boolean;
  predictedChampion: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  deadlinePassed: boolean;
  currentUserId?: string;
}

function formatPercentile(rank: number, total: number): string {
  if (total <= 1) return "Top 1%";
  const pct = Math.max(1, Math.ceil((rank / total) * 100));
  return `Top ${pct}%`;
}

function UserAvatar({ avatarUrl, nickname }: { avatarUrl: string | null; nickname: string }) {
  const letter = (nickname || "?")[0].toUpperCase();
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={nickname}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-brand-border flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-brand-subtext">{letter}</span>
    </div>
  );
}

export default function LeaderboardTable({
  entries,
  deadlinePassed,
  currentUserId,
}: LeaderboardTableProps) {
  const showPredictions = deadlinePassed && PREDICTIONS_PUBLIC_AFTER_DEADLINE;
  const total = entries.length;

  if (total === 0) {
    return (
      <div className="text-center text-brand-subtext py-12">
        No predictions submitted yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border text-brand-subtext text-left">
            <th className="pb-3 pr-4 font-medium">Total Score</th>
            <th className="pb-3 pr-4 font-medium">User</th>
            <th className="pb-3 pr-4 font-medium text-right">Correct Matches</th>
            <th className="pb-3 pr-4 font-medium">Predicted Champion</th>
            <th className="pb-3 font-medium text-right">Submitted Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isCurrentUser   = entry.userId === currentUserId;
            const percentile      = formatPercentile(entry.rank, total);
            const displayNickname = entry.nickname || entry.username;
            const profileHref      = `/prediction/${entry.userId}`;

            // Score color tiers
            const scoreColor =
              entry.rank === 1 ? "text-brand-gold font-extrabold" :
              entry.rank === 2 ? "text-gray-300 font-bold" :
              entry.rank === 3 ? "text-amber-600 font-bold" :
              "text-white font-bold";

            return (
              <tr
                key={entry.userId}
                className={`border-b border-brand-border/50 transition-colors ${
                  isCurrentUser ? "bg-brand-accent/10" : "hover:bg-brand-card/50"
                }`}
              >
                {/* Total Score — primary ranking indicator */}
                <td className="py-3 pr-4 whitespace-nowrap">
                  <span className={`text-lg ${scoreColor}`}>{entry.totalScore}</span>
                  <span className="text-brand-muted text-xs ml-1">pts</span>
                </td>

                {/* User: avatar + nickname (username) + percentile badge */}
                <td className="py-3 pr-4">
                  <Link href={profileHref} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                    <UserAvatar avatarUrl={entry.avatarUrl} nickname={displayNickname} />
                    <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                      <span className={`font-semibold ${isCurrentUser ? "text-brand-accent" : "text-white"}`}>
                        {displayNickname}
                      </span>
                      <span className="text-brand-muted text-xs">
                        ({entry.username})
                      </span>
                      {isCurrentUser && (
                        <span className="text-[10px] text-brand-accent bg-brand-accent/20 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </div>
                    <span className="ml-auto pl-3 text-[11px] font-semibold text-brand-gold bg-brand-gold/10 border border-brand-gold/30 px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                      {percentile}
                    </span>
                  </Link>
                </td>

                {/* Correct Matches */}
                <td className="py-3 pr-4 text-right text-brand-subtext">
                  {entry.correctMatchCount}
                </td>

                {/* Predicted Champion */}
                <td className="py-3 pr-4">
                  {showPredictions ? (
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium ${
                        entry.championCorrect ? "text-green-400" : "text-brand-subtext"
                      }`}>
                        {entry.predictedChampion ?? "—"}
                      </span>
                      {entry.championCorrect && (
                        <span className="text-green-400 text-[10px]">✓</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-brand-muted text-xs italic">Hidden</span>
                  )}
                </td>

                {/* Submitted Time */}
                <td className="py-3 text-right text-brand-subtext text-xs">
                  {entry.submittedAt
                    ? new Date(entry.submittedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Seoul",
                      })
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
