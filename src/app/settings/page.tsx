"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ALLOWED_AVATARS } from "@/lib/avatars";

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  // ── Nickname state ──────────────────────────────────────────────────────
  const [nickname, setNickname]             = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameMsg, setNicknameMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Avatar state ────────────────────────────────────────────────────────
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving]     = useState(false);
  const [avatarMsg, setAvatarMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Visibility state ────────────────────────────────────────────────────
  const [isPublic, setIsPublic]             = useState(true);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityMsg, setVisibilityMsg]   = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/settings");
  }, [status, router]);

  // Load profile data from server
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.nickname !== undefined) setNickname(data.nickname);
        if (data.avatarUrl)              setSelectedAvatar(data.avatarUrl);
        if (data.isPredictionPublic !== undefined) setIsPublic(data.isPredictionPublic);
      })
      .catch(() => {});
  }, [status]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  /** Push updated fields into the NextAuth JWT/session and refresh server components. */
  async function syncSession(patch: { nickname?: string; avatarUrl?: string | null; isPredictionPublic?: boolean }) {
    await update({ user: patch });
    router.refresh();
  }

  async function handleSaveNickname() {
    if (!nickname.trim()) return;
    setNicknameSaving(true);
    setNicknameMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save nickname.");
      await syncSession({
        nickname:           data.nickname,
        avatarUrl:          data.avatarUrl,
        isPredictionPublic: data.isPredictionPublic,
      });
      setNicknameMsg({ type: "ok", text: "Nickname updated." });
    } catch (e: unknown) {
      setNicknameMsg({ type: "err", text: (e as Error).message });
    } finally {
      setNicknameSaving(false);
    }
  }

  async function handleSaveAvatar() {
    if (!selectedAvatar) return;
    setAvatarSaving(true);
    setAvatarMsg(null);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: selectedAvatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save avatar.");
      await syncSession({
        avatarUrl:          data.avatarUrl,
        nickname:           data.nickname,
        isPredictionPublic: data.isPredictionPublic,
      });
      setAvatarMsg({ type: "ok", text: "Avatar updated." });
    } catch (e: unknown) {
      setAvatarMsg({ type: "err", text: (e as Error).message });
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSaveVisibility(newValue: boolean) {
    setIsPublic(newValue);
    setVisibilitySaving(true);
    setVisibilityMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPredictionPublic: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update visibility.");
      await syncSession({
        isPredictionPublic: data.isPredictionPublic,
        nickname:           data.nickname,
        avatarUrl:          data.avatarUrl,
      });
      setVisibilityMsg({ type: "ok", text: "Visibility updated." });
    } catch (e: unknown) {
      setIsPublic(!newValue); // revert optimistic update
      setVisibilityMsg({ type: "err", text: (e as Error).message });
    } finally {
      setVisibilitySaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-brand-subtext">Loading…</div>
      </div>
    );
  }

  const currentAvatar  = selectedAvatar ?? session?.user?.avatarUrl ?? null;
  const displayName    = session?.user?.nickname || session?.user?.name || "?";
  const letter         = displayName[0].toUpperCase();
  const avatarPool     = ALLOWED_AVATARS.filter((a) => a !== "/avatars/default.png");
  const avatarChanged  = selectedAvatar !== null && selectedAvatar !== (session?.user?.avatarUrl ?? null);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
        <p className="text-brand-subtext text-sm mt-1">Manage your nickname, avatar, and prediction visibility.</p>
      </div>

      {/* Current profile preview */}
      <div className="flex items-center gap-4 bg-brand-card border border-brand-border rounded-xl p-4">
        {currentAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentAvatar}
            alt={displayName}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-brand-border flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-brand-subtext">{letter}</span>
          </div>
        )}
        <div>
          <div className="text-white font-semibold text-lg">{displayName}</div>
          {session?.user?.name && (
            <div className="text-brand-muted text-sm">({session.user.name})</div>
          )}
        </div>
      </div>

      {/* ── Nickname section ─────────────────────────────────────────────── */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Edit Nickname</h2>
        <p className="text-xs text-brand-subtext">2–12 characters. Korean, English, numbers, and underscores allowed.</p>

        {nicknameMsg && (
          <div className={`rounded-lg px-4 py-2.5 text-sm ${
            nicknameMsg.type === "ok"
              ? "bg-green-500/15 border border-green-500/40 text-green-400"
              : "bg-red-500/15 border border-red-500/40 text-red-400"
          }`}>
            {nicknameMsg.text}
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-brand-subtext mb-1.5">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              minLength={2}
              maxLength={12}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent transition-colors"
              placeholder="Your display name"
            />
          </div>
          <button
            onClick={handleSaveNickname}
            disabled={nicknameSaving || !nickname.trim() || nickname.trim() === (session?.user?.nickname ?? "")}
            className="px-5 py-2.5 bg-brand-accent hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {nicknameSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Avatar section ───────────────────────────────────────────────── */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Select Avatar</h2>

        {avatarMsg && (
          <div className={`rounded-lg px-4 py-2.5 text-sm ${
            avatarMsg.type === "ok"
              ? "bg-green-500/15 border border-green-500/40 text-green-400"
              : "bg-red-500/15 border border-red-500/40 text-red-400"
          }`}>
            {avatarMsg.text}
          </div>
        )}

        <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
          {avatarPool.map((url) => {
            const isSelected = selectedAvatar === url;
            return (
              <button
                key={url}
                onClick={() => setSelectedAvatar(url)}
                className={`relative rounded-full overflow-hidden border-2 transition-all aspect-square ${
                  isSelected
                    ? "border-brand-accent ring-2 ring-brand-accent/40 scale-105"
                    : "border-brand-border hover:border-brand-subtext"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Avatar option"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-brand-accent/20">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSaveAvatar}
          disabled={avatarSaving || !selectedAvatar || !avatarChanged}
          className="w-full py-2.5 bg-brand-accent hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
        >
          {avatarSaving ? "Saving…" : "Save Avatar"}
        </button>
      </div>

      {/* ── Prediction Visibility section ────────────────────────────────── */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Prediction Visibility</h2>
        <p className="text-xs text-brand-subtext">
          When set to <strong className="text-white">Public</strong>, anyone can view your prediction profile after the deadline.
          When set to <strong className="text-white">Private</strong>, only you and admins can see it.
        </p>

        {visibilityMsg && (
          <div className={`rounded-lg px-4 py-2.5 text-sm ${
            visibilityMsg.type === "ok"
              ? "bg-green-500/15 border border-green-500/40 text-green-400"
              : "bg-red-500/15 border border-red-500/40 text-red-400"
          }`}>
            {visibilityMsg.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => !isPublic && !visibilitySaving && handleSaveVisibility(true)}
            disabled={visibilitySaving}
            className={`flex-1 py-2.5 px-4 rounded-lg border font-semibold text-sm transition-colors ${
              isPublic
                ? "bg-green-500/20 border-green-500/60 text-green-400"
                : "bg-brand-border/30 border-brand-border text-brand-subtext hover:text-white hover:border-brand-subtext"
            }`}
          >
            Public
          </button>
          <button
            onClick={() => isPublic && !visibilitySaving && handleSaveVisibility(false)}
            disabled={visibilitySaving}
            className={`flex-1 py-2.5 px-4 rounded-lg border font-semibold text-sm transition-colors ${
              !isPublic
                ? "bg-red-500/20 border-red-500/60 text-red-400"
                : "bg-brand-border/30 border-brand-border text-brand-subtext hover:text-white hover:border-brand-subtext"
            }`}
          >
            Private
          </button>
        </div>

        <p className="text-xs text-brand-muted">
          Current: <span className={`font-semibold ${isPublic ? "text-green-400" : "text-red-400"}`}>
            {isPublic ? "Public" : "Private"}
          </span>
          {visibilitySaving && <span className="ml-2 text-brand-muted">Saving…</span>}
        </p>
      </div>
    </div>
  );
}
