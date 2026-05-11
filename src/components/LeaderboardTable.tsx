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

function getPercentileBadge(rank: number, total: number): string | null {
  if (total === 0) return null;
  const pct = (rank / total) * 100;
  if (pct <= 1)  return "상위 1%";
  if (pct <= 5)  return "상위 5%";
  if (pct <= 10) return "상위 10%";
  if (pct <= 30) return "상위 30%";
  return null;
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
        아직 제출된 예측이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border text-brand-subtext text-left">
            <th className="pb-3 pr-4 font-medium w-12">#</th>
            <th className="pb-3 pr-4 font-medium">플레이어</th>
            <th className="pb-3 pr-4 font-medium text-right">총점</th>
            <th className="pb-3 pr-4 font-medium text-right">적중</th>
            <th className="pb-3 pr-4 font-medium">예측 우승팀</th>
            <th className="pb-3 font-medium text-right">제출 시각</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isCurrentUser = entry.userId === currentUserId;
            const rankColors: Record<number, string> = {
              1: "text-brand-gold font-bold",
              2: "text-gray-300 font-semibold",
              3: "text-amber-600 font-semibold",
            };
            const percentileBadge = getPercentileBadge(entry.rank, total);
            const displayNickname = entry.nickname || entry.username;

            return (
              <tr
                key={entry.userId}
                className={`border-b border-brand-border/50 transition-colors ${
                  isCurrentUser ? "bg-brand-accent/10" : "hover:bg-brand-card/50"
                }`}
              >
                {/* Rank */}
                <td className="py-3 pr-4">
                  <span className={rankColors[entry.rank] ?? "text-brand-subtext"}>
                    {entry.rank}
                  </span>
                </td>

                {/* Player: avatar + nickname (username) + badges */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <UserAvatar avatarUrl={entry.avatarUrl} nickname={displayNickname} />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-semibold ${isCurrentUser ? "text-brand-accent" : "text-white"}`}>
                          {displayNickname}
                        </span>
                        <span className="text-brand-muted text-xs">
                          ({entry.username})
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] text-brand-accent bg-brand-accent/20 px-1.5 py-0.5 rounded">
                            나
                          </span>
                        )}
                      </div>
                      {percentileBadge && (
                        <span className="text-[10px] text-brand-gold font-medium mt-0.5">
                          {percentileBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Score */}
                <td className="py-3 pr-4 text-right">
                  <span className="font-bold text-white">{entry.totalScore}</span>
                </td>

                {/* Correct match count */}
                <td className="py-3 pr-4 text-right text-brand-subtext">
                  {entry.correctMatchCount}
                </td>

                {/* Champion pick */}
                <td className="py-3 pr-4">
                  {showPredictions ? (
                    <div className="flex items-center gap-1.5">
                      <span className={`font-medium ${
                        entry.championCorrect
                          ? "text-green-400"
                          : "text-brand-subtext"
                      }`}>
                        {entry.predictedChampion ?? "—"}
                      </span>
                      {entry.championCorrect && (
                        <span className="text-green-400 text-[10px]">✓</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-brand-muted text-xs italic">비공개</span>
                  )}
                </td>

                {/* Submitted */}
                <td className="py-3 text-right text-brand-subtext text-xs">
                  {entry.submittedAt
                    ? new Date(entry.submittedAt).toLocaleString("ko-KR", {
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

      {showPredictions && (
        <div className="mt-4 flex flex-wrap gap-2">
          {entries.map((e) => (
            <Link
              key={e.userId}
              href={`/prediction/${e.userId}`}
              className="text-xs text-brand-subtext hover:text-brand-accent transition-colors underline"
            >
              {e.nickname || e.username}의 예측 →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
