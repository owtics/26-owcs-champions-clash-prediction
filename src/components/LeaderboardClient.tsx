"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import LeaderboardTable, { LeaderboardEntry } from "./LeaderboardTable";

// Shape returned by the API (no rank yet — computed client-side)
interface ApiEntry {
  userId: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  totalScore: number;
  correctMatchCount: number;
  championCorrect: boolean;
  predictedChampion: string | null;
  grandFinalPick: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

interface ApiResponse {
  leaderboard: ApiEntry[];
  hasMore: boolean;
  totalParticipants: number;
  deadlinePassed: boolean;
}

const PAGE_SIZE = 20;

/** Assign ranks to accumulated entries (tie-aware). */
function computeRanks(entries: ApiEntry[]): LeaderboardEntry[] {
  let rank = 1;
  return entries.map((entry, i) => {
    if (i > 0 && entries[i].totalScore < entries[i - 1].totalScore) rank = i + 1;
    // LeaderboardEntry requires the exact fields; extra fields (grandFinalPick) are fine
    return { rank, ...entry };
  });
}

interface Props {
  currentUserId?: string;
}

export default function LeaderboardClient({ currentUserId }: Props) {
  const [entries, setEntries]               = useState<ApiEntry[]>([]);
  const [nextOffset, setNextOffset]         = useState(0);
  const [hasMore, setHasMore]               = useState(true);
  const [totalParticipants, setTotal]       = useState(0);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [search, setSearch]                 = useState("");
  const [debouncedSearch, setDebounced]     = useState("");

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef  = useRef(false); // guards against duplicate concurrent fetches

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // ── Reset when search changes ──────────────────────────────────────────────
  useEffect(() => {
    setEntries([]);
    setNextOffset(0);
    setHasMore(true);
  }, [debouncedSearch]);

  // ── Core fetch function ────────────────────────────────────────────────────
  const fetchPage = useCallback(async (offset: number, searchTerm: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        limit:  String(PAGE_SIZE),
        offset: String(offset),
      });
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/leaderboard?${params}`);
      if (!res.ok) return;

      const data: ApiResponse = await res.json();

      setEntries((prev) =>
        offset === 0 ? data.leaderboard : [...prev, ...data.leaderboard]
      );
      setNextOffset(offset + data.leaderboard.length);
      setHasMore(data.hasMore);
      setTotal(data.totalParticipants);
      setDeadlinePassed(data.deadlinePassed);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // ── Initial load (and re-load on search change) ────────────────────────────
  useEffect(() => {
    fetchPage(0, debouncedSearch);
  }, [debouncedSearch, fetchPage]);

  // ── Infinite scroll via IntersectionObserver ───────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingRef.current) {
          fetchPage(nextOffset, debouncedSearch);
        }
      },
      { rootMargin: "120px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, nextOffset, debouncedSearch, fetchPage]);

  const ranked = computeRanks(entries);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nickname..."
          className="w-full bg-brand-card border border-brand-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors text-lg leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Participant count */}
      {totalParticipants > 0 && (
        <p className="text-brand-subtext text-sm">
          {debouncedSearch
            ? `${ranked.length} result${ranked.length !== 1 ? "s" : ""} · ${totalParticipants} total participant${totalParticipants !== 1 ? "s" : ""}`
            : `${totalParticipants} participant${totalParticipants !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Leaderboard table */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        {isLoading && entries.length === 0 ? (
          /* Initial load skeleton */
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-5 w-10 bg-brand-border rounded" />
                <div className="h-8 w-8 rounded-full bg-brand-border" />
                <div className="h-5 w-32 bg-brand-border rounded" />
                <div className="ml-auto h-5 w-16 bg-brand-border rounded" />
              </div>
            ))}
          </div>
        ) : (
          <LeaderboardTable
            entries={ranked}
            deadlinePassed={deadlinePassed}
            currentUserId={currentUserId}
            totalParticipants={totalParticipants}
          />
        )}
      </div>

      {/* Sentinel div — IntersectionObserver target */}
      <div ref={sentinelRef} className="h-1" aria-hidden />

      {/* Loading more indicator */}
      {isLoading && entries.length > 0 && (
        <div className="flex justify-center py-4 gap-2 items-center text-brand-subtext text-sm">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
            />
          </svg>
          Loading…
        </div>
      )}

      {/* End of list */}
      {!hasMore && !isLoading && entries.length > 0 && (
        <p className="text-center text-brand-muted text-xs py-3">
          {debouncedSearch
            ? `All matching results shown.`
            : `All ${totalParticipants} participant${totalParticipants !== 1 ? "s" : ""} loaded.`}
        </p>
      )}

      {/* No results */}
      {!isLoading && entries.length === 0 && debouncedSearch && (
        <div className="text-center text-brand-subtext py-10">
          No users found for &ldquo;{debouncedSearch}&rdquo;.
        </div>
      )}
    </div>
  );
}
