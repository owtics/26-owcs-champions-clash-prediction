"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Bracket, { BracketMatch, PickMap } from "@/components/Bracket";
import DeadlineBanner from "@/components/DeadlineBanner";
import { PREDICTION_DEADLINE } from "@/lib/constants";
import { propagateBracket, buildPickMap, buildInitialTeams } from "@/lib/bracket";

interface Team {
  code: string;
  seed: number | null;
  logoUrl?: string | null;
}

interface MatchData {
  id: string;
  matchNumber: number;
  roundName: string;
  bracketType: string;
  team1: Team | null;
  team2: Team | null;
  actualWinner: Team | null;
}

export default function PredictPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [matches, setMatches]   = useState<MatchData[]>([]);
  const [picks, setPicks]       = useState<PickMap>({});
  const [champion, setChampion] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const deadlinePassed = new Date() >= PREDICTION_DEADLINE;

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/predict");
  }, [status, router]);

  // Load matches and existing prediction
  useEffect(() => {
    if (status !== "authenticated") return;

    async function load() {
      const [matchRes, predRes] = await Promise.all([
        fetch("/api/matches"),
        fetch("/api/predictions"),
      ]);

      const matchData = await matchRes.json();
      setMatches(matchData.matches ?? []);

      const predData = await predRes.json();
      if (predData.prediction) {
        const p = predData.prediction;
        const restored: PickMap = {};
        for (const pick of p.picks ?? []) {
          if (pick.predictedWinner?.code) {
            restored[pick.matchNumber] = pick.predictedWinner.code;
          }
        }
        setPicks(restored);
        setChampion(p.champion?.code ?? null);
      }

      setLoadingData(false);
    }

    load().catch(() => setLoadingData(false));
  }, [status]);

  // When user picks a winner, update picks and propagate
  const handlePick = useCallback(
    (matchNumber: number, teamCode: string) => {
      if (deadlinePassed) return;

      setPicks((prev) => {
        // If clicking the already-selected winner, deselect it and clear downstream
        if (prev[matchNumber] === teamCode) {
          const next = { ...prev };
          // Remove this pick and all downstream picks that depended on it
          clearDownstream(matchNumber, next, matches);
          return next;
        }

        const next = { ...prev, [matchNumber]: teamCode };
        // Clear downstream picks that are now invalid (different teams)
        clearDownstream(matchNumber, next, matches, teamCode);
        return next;
      });

      setSaved(false);
    },
    [deadlinePassed, matches]
  );

  // Derive champion from M14 winner (auto-set when M14 is picked)
  useEffect(() => {
    if (picks[14]) setChampion(picks[14]);
  }, [picks]);

  // Build bracket state for rendering
  const initialTeams = buildInitialTeams(
    matches
      .filter((m) => m.matchNumber <= 4)
      .map((m) => ({
        matchNumber: m.matchNumber,
        team1Code:   m.team1?.code ?? null,
        team2Code:   m.team2?.code ?? null,
      }))
  );

  const bracketState = propagateBracket(
    buildPickMap(
      Object.entries(picks).map(([mn, code]) => ({
        matchNumber: parseInt(mn, 10),
        winnerCode:  code,
      }))
    ),
    initialTeams
  );

  // Build team lookup maps for bracket display
  const teamSeeds:  Record<string, number | null> = {};
  const teamLogos:  Record<string, string | null> = {};
  for (const m of matches) {
    if (m.team1?.code) {
      teamSeeds[m.team1.code] = m.team1.seed;
      teamLogos[m.team1.code] = m.team1.logoUrl ?? null;
    }
    if (m.team2?.code) {
      teamSeeds[m.team2.code] = m.team2.seed;
      teamLogos[m.team2.code] = m.team2.logoUrl ?? null;
    }
  }

  async function handleSave() {
    if (deadlinePassed) return;
    setSaving(true);
    setError(null);

    const picksArray = Object.entries(picks).map(([mn, code]) => ({
      matchNumber: parseInt(mn, 10),
      predictedWinnerCode: code,
    }));

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks: picksArray, championCode: champion }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save prediction.");
    } else {
      setSaved(true);
    }
  }

  const totalPicks = Object.keys(picks).length;
  const allPicksDone = totalPicks === 14;

  const bracketMatches: BracketMatch[] = matches.map((m) => ({
    matchNumber:     m.matchNumber,
    roundName:       m.roundName,
    bracketType:     m.bracketType,
    team1:           m.team1 ?? null,
    team2:           m.team2 ?? null,
    actualWinnerCode: m.actualWinner?.code ?? null,
  }));

  if (status === "loading" || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-brand-subtext">브라켓 로딩 중…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">내 승부예측</h1>
          <p className="text-brand-subtext text-sm mt-0.5">
            팀을 클릭하여 승자를 선택하세요 · {totalPicks}/14 경기 선택됨
          </p>
        </div>
        {!deadlinePassed && (
          <div className="flex items-center gap-3">
            {champion && (
              <div className="flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-3 py-2">
                <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold">
                  예측 우승팀
                </span>
                <span className="text-brand-gold font-bold">{champion}</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || totalPicks === 0}
              className="px-5 py-2 bg-brand-accent hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {saving ? "저장 중…" : saved ? "저장됨 ✓" : "예측 저장"}
            </button>
          </div>
        )}
      </div>

      {/* Deadline banner */}
      <DeadlineBanner />

      {/* Error */}
      {error && (
        <div className="bg-red-500/15 border border-red-500/40 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Locked notice */}
      {deadlinePassed && (
        <div className="bg-brand-card border border-brand-border rounded-lg px-4 py-3 text-sm text-brand-subtext">
          예측 마감 시각이 지났습니다. 예측이 잠금 처리되었습니다.
          {champion && (
            <span className="ml-2 text-brand-gold font-semibold">
              예측 우승팀: {champion}
            </span>
          )}
        </div>
      )}

      {/* Bracket */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <Bracket
          matches={bracketMatches}
          picks={picks}
          onPick={deadlinePassed ? undefined : handlePick}
          disabled={deadlinePassed}
          showResults={false}
          teamSeeds={teamSeeds}
          teamLogos={teamLogos}
        />
      </div>

      {/* Progress + save */}
      {!deadlinePassed && (
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <div className="flex gap-3">
            {/* Progress pills */}
            {Array.from({ length: 14 }, (_, i) => i + 1).map((mn) => (
              <div
                key={mn}
                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                  picks[mn]
                    ? "bg-brand-accent text-white"
                    : bracketState.get(mn)?.team1 && bracketState.get(mn)?.team2
                    ? "bg-brand-border text-brand-subtext border border-brand-border/50"
                    : "bg-brand-border/30 text-brand-muted/50"
                }`}
                title={`Match ${mn}${picks[mn] ? `: ${picks[mn]}` : ""}`}
              >
                {mn}
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || totalPicks === 0}
            className={`px-6 py-2.5 font-semibold rounded-lg transition-colors text-sm ${
              allPicksDone
                ? "bg-brand-green text-white hover:bg-green-400"
                : "bg-brand-accent text-white hover:bg-blue-500"
            } disabled:opacity-50`}
          >
            {saving
              ? "저장 중…"
              : saved
              ? "저장됨 ✓"
              : allPicksDone
              ? "전체 예측 제출"
              : `저장 (${totalPicks}/14 경기)`}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Clear picks that are downstream of matchNumber.
 * When a winner changes, any picks in later matches that involved teams
 * flowing from this match must be cleared.
 */
function clearDownstream(
  matchNumber: number,
  picks: PickMap,
  matches: MatchData[],
  newWinner?: string
) {
  // Build a map of what feeds into what
  // When match N's winner changes, we need to clear picks for all matches
  // that receive teams from match N (transitively).

  // For simplicity: recalculate which matches are now unreachable given current picks
  // by propagating and seeing which match slots change team.

  // Strategy: delete the pick for matchNumber first (if new winner provided, we keep it)
  // Then for each downstream match, check if its teams would change and clear if so.

  const DOWNSTREAM: Record<number, number[]> = {
    1:  [5, 7, 9, 11, 12, 13, 14],
    2:  [6, 8, 10, 11, 12, 13, 14],
    3:  [5, 7, 9, 11, 12, 13, 14],
    4:  [6, 8, 10, 11, 12, 13, 14],
    5:  [9, 11, 13, 14],
    6:  [10, 11, 13, 14],
    7:  [9, 11, 12, 13, 14],
    8:  [10, 11, 12, 13, 14],
    9:  [11, 13, 14],
    10: [11, 13, 14],
    11: [13, 14],
    12: [13, 14],
    13: [14],
    14: [],
  };

  const toCheck = DOWNSTREAM[matchNumber] ?? [];
  for (const mn of toCheck) {
    delete picks[mn];
  }
}
