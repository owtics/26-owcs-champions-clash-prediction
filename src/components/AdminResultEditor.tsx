"use client";

import { useState, useEffect } from "react";
import { propagateBracket, buildPickMap, buildInitialTeams } from "@/lib/bracket";

interface Team {
  id: string;
  code: string;
  name: string;
  seed: number | null;
}

interface MatchRow {
  id: string;
  matchNumber: number;
  roundName: string;
  team1: Team | null;
  team2: Team | null;
  actualWinner: Team | null;
}

export default function AdminResultEditor() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [localResults, setLocalResults] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/results")
      .then((r) => r.json())
      .then((data) => {
        setMatches(data.matches ?? []);
        // Pre-fill with existing actual winners
        const init: Record<number, string> = {};
        for (const m of data.matches ?? []) {
          if (m.actualWinner?.code) init[m.matchNumber] = m.actualWinner.code;
        }
        setLocalResults(init);
      })
      .catch(() => setMessage({ type: "err", text: "경기 정보를 불러오지 못했습니다." }));
  }, []);

  // ── Propagate resolved teams based on current local results ────────────
  const initialTeams = buildInitialTeams(
    matches
      .filter((m) => m.matchNumber <= 4)
      .map((m) => ({
        matchNumber: m.matchNumber,
        team1Code:   m.team1?.code ?? null,
        team2Code:   m.team2?.code ?? null,
      }))
  );

  const pickMap = buildPickMap(
    Object.entries(localResults).map(([mn, code]) => ({
      matchNumber: parseInt(mn, 10),
      winnerCode:  code || null,
    }))
  );

  const bracketState = propagateBracket(pickMap, initialTeams);

  function getTeamsForMatch(mn: number) {
    if (mn <= 4) {
      const m = matches.find((x) => x.matchNumber === mn);
      return { team1: m?.team1?.code ?? null, team2: m?.team2?.code ?? null };
    }
    const ms = bracketState.get(mn);
    return { team1: ms?.team1 ?? null, team2: ms?.team2 ?? null };
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const results = Object.entries(localResults)
      .filter(([, code]) => !!code)
      .map(([mn, code]) => ({ matchNumber: parseInt(mn, 10), actualWinnerCode: code }));

    try {
      const res = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMessage({ type: "ok", text: "결과가 저장되고 점수가 재계산되었습니다." });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalculate() {
    setRecalcLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/recalculate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "실패");
      setMessage({ type: "ok", text: `${data.updated}명의 점수가 재계산되었습니다.` });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setRecalcLoading(false);
    }
  }

  const ROUND_ORDER = [
    { label: "승자조 1라운드", nums: [1, 2, 3, 4] },
    { label: "패자조 1라운드", nums: [5, 6] },
    { label: "승자조 준결승",  nums: [7, 8] },
    { label: "패자조 2라운드", nums: [9, 10] },
    { label: "패자조 3라운드", nums: [11] },
    { label: "승자조 결승",    nums: [12] },
    { label: "패자조 결승",    nums: [13] },
    { label: "그랜드 파이널",  nums: [14] },
  ];

  return (
    <div className="space-y-6">
      {/* Status message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-green-500/15 border border-green-500/40 text-green-400"
              : "bg-red-500/15 border border-red-500/40 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Match result inputs */}
      {ROUND_ORDER.map((round) => (
        <div key={round.label}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-subtext mb-3">
            {round.label}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {round.nums.map((mn) => {
              const { team1, team2 } = getTeamsForMatch(mn);
              const selected = localResults[mn] ?? "";

              return (
                <div
                  key={mn}
                  className="bg-brand-card border border-brand-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-brand-subtext">경기 {mn}</span>
                    {selected && (
                      <span className="text-xs text-green-400 font-medium">
                        승자: {selected}
                      </span>
                    )}
                  </div>

                  {!team1 || !team2 ? (
                    <p className="text-xs text-brand-muted italic">
                      이전 결과를 기다리는 중…
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      {[team1, team2].map((code) => (
                        <button
                          key={code}
                          onClick={() =>
                            setLocalResults((prev) => ({
                              ...prev,
                              [mn]: prev[mn] === code ? "" : code!,
                            }))
                          }
                          className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold border transition-colors ${
                            selected === code
                              ? "bg-brand-accent border-brand-accent text-white"
                              : "bg-brand-border/30 border-brand-border text-brand-subtext hover:text-white hover:border-brand-subtext"
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-brand-accent hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
        >
          {saving ? "저장 중…" : "결과 저장"}
        </button>
        <button
          onClick={handleRecalculate}
          disabled={recalcLoading}
          className="px-6 py-2.5 bg-brand-border hover:bg-brand-border/80 disabled:opacity-60 text-brand-text font-semibold rounded-lg transition-colors"
        >
          {recalcLoading ? "재계산 중…" : "점수 재계산"}
        </button>
      </div>
    </div>
  );
}
