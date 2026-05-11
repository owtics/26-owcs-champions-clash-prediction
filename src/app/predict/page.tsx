"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BracketViewer from "@/components/BracketViewer";
import { BracketMatch, PickMap } from "@/components/Bracket";
import DeadlineBanner from "@/components/DeadlineBanner";
import { PREDICTION_DEADLINE, MATCH_POINTS } from "@/lib/constants";
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

  const [matches, setMatches]         = useState<MatchData[]>([]);
  const [picks, setPicks]             = useState<PickMap>({});
  const [champion, setChampion]       = useState<string | null>(null);
  const [correctPicks, setCorrectPicks] = useState<Record<number, boolean | null>>({});
  const [pickPoints, setPickPoints]   = useState<Record<number, number>>({});
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [deadline, setDeadline]       = useState<Date>(PREDICTION_DEADLINE);

  const deadlinePassed = new Date() >= deadline;

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => { if (data.deadline) { const d = new Date(data.deadline); setDeadline(d); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/predict");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function load() {
      const [matchRes, predRes] = await Promise.all([
        fetch("/api/matches"),
        fetch("/api/predictions"),
      ]);

      const matchData = await matchRes.json();
      const loadedMatches: MatchData[] = matchData.matches ?? [];
      setMatches(loadedMatches);

      // Build actual winner lookup for fallback scoring
      const actualByMatch: Record<number, string | null> = {};
      for (const m of loadedMatches) {
        actualByMatch[m.matchNumber] = m.actualWinner?.code ?? null;
      }

      const predData = await predRes.json();
      if (predData.prediction) {
        const p = predData.prediction;
        const restored: PickMap = {};
        const restoredCorrect: Record<number, boolean | null> = {};
        const restoredPoints: Record<number, number> = {};

        for (const pick of p.picks ?? []) {
          const mn: number = pick.matchNumber;
          if (pick.predictedWinner?.code) {
            restored[mn] = pick.predictedWinner.code;
          }

          // Use stored isCorrect/pointsAwarded when scoring has run (isCorrect non-null),
          // otherwise derive from predicted vs actual winner code.
          if (pick.isCorrect !== null && pick.isCorrect !== undefined) {
            restoredCorrect[mn] = pick.isCorrect as boolean;
            restoredPoints[mn]  = pick.pointsAwarded as number;
          } else {
            const actual = actualByMatch[mn];
            if (actual !== null && actual !== undefined) {
              const correct = pick.predictedWinner?.code === actual;
              restoredCorrect[mn] = correct;
              restoredPoints[mn]  = correct ? (MATCH_POINTS[mn] ?? 0) : 0;
            } else {
              restoredCorrect[mn] = null;
              restoredPoints[mn]  = 0;
            }
          }
        }

        setPicks(restored);
        setCorrectPicks(restoredCorrect);
        setPickPoints(restoredPoints);
        setChampion(p.champion?.code ?? null);
      }

      setLoadingData(false);
    }

    load().catch(() => setLoadingData(false));
  }, [status]);

  const handlePick = useCallback(
    (matchNumber: number, teamCode: string) => {
      if (deadlinePassed) return;

      setPicks((prev) => {
        if (prev[matchNumber] === teamCode) {
          const next = { ...prev };
          clearDownstream(matchNumber, next, matches);
          return next;
        }

        const next = { ...prev, [matchNumber]: teamCode };
        clearDownstream(matchNumber, next, matches, teamCode);
        return next;
      });

      setSaved(false);
    },
    [deadlinePassed, matches]
  );

  useEffect(() => {
    if (picks[14]) setChampion(picks[14]);
  }, [picks]);

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

  const teamSeeds: Record<string, number | null> = {};
  const teamLogos: Record<string, string | null> = {};
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

  const totalPicks  = Object.keys(picks).length;
  const allPicksDone = totalPicks === 14;

  const bracketMatches: BracketMatch[] = matches.map((m) => ({
    matchNumber:      m.matchNumber,
    roundName:        m.roundName,
    bracketType:      m.bracketType,
    team1:            m.team1 ?? null,
    team2:            m.team2 ?? null,
    actualWinnerCode: m.actualWinner?.code ?? null,
  }));

  if (status === "loading" || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-brand-subtext">Loading bracket…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Prediction</h1>
          <p className="text-brand-subtext text-sm mt-0.5">
            Click a team to pick the winner · {totalPicks}/14 matches selected
          </p>
        </div>
        {!deadlinePassed && (
          <div className="flex items-center gap-3">
            {champion && (
              <div className="flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/30 rounded-lg px-3 py-2">
                <span className="text-[10px] text-brand-gold uppercase tracking-widest font-bold">
                  Predicted Champion
                </span>
                <span className="text-brand-gold font-bold">{champion}</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || totalPicks === 0}
              className="px-5 py-2 bg-brand-accent hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save Prediction"}
            </button>
          </div>
        )}
      </div>

      <DeadlineBanner />

      {error && (
        <div className="bg-red-500/15 border border-red-500/40 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Deadline locked notice */}
      {deadlinePassed && (
        <div className="bg-brand-card border border-brand-border rounded-lg px-4 py-3 text-sm text-brand-subtext">
          The prediction deadline has passed. No changes can be made.
          {champion && (
            <span className="ml-2 text-brand-gold font-semibold">
              Predicted Champion: {champion}
            </span>
          )}
        </div>
      )}

      {/* Bracket with expand */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <BracketViewer
          matches={bracketMatches}
          picks={picks}
          onPick={deadlinePassed ? undefined : handlePick}
          disabled={deadlinePassed}
          showResults
          correctPicks={correctPicks}
          pickPoints={pickPoints}
          teamSeeds={teamSeeds}
          teamLogos={teamLogos}
        />
      </div>

      {/* Progress + save */}
      {!deadlinePassed && (
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <div className="flex gap-3">
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
              ? "Saving…"
              : saved
              ? "Saved ✓"
              : allPicksDone
              ? "Submit All Picks"
              : `Save (${totalPicks}/14 matches)`}
          </button>
        </div>
      )}
    </div>
  );
}

function clearDownstream(
  matchNumber: number,
  picks: PickMap,
  matches: MatchData[],
  newWinner?: string
) {
  void matches;
  void newWinner;
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
