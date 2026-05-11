"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ALLOWED_AVATARS } from "@/lib/avatars";

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/settings");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.avatarUrl) setSelectedAvatar(session.user.avatarUrl);
  }, [session]);

  async function handleSave() {
    if (!selectedAvatar) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: selectedAvatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save avatar.");
      await update({ avatarUrl: selectedAvatar });
      setMessage({ type: "ok", text: "Avatar updated successfully." });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-brand-subtext">Loading…</div>
      </div>
    );
  }

  const avatarPool = ALLOWED_AVATARS.filter((a) => a !== "/avatars/default.png");
  const currentAvatar = selectedAvatar ?? session?.user?.avatarUrl ?? null;
  const displayName = session?.user?.nickname || session?.user?.name || "?";
  const letter = displayName[0].toUpperCase();

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
        <p className="text-brand-subtext text-sm mt-1">Choose your avatar.</p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          message.type === "ok"
            ? "bg-green-500/15 border border-green-500/40 text-green-400"
            : "bg-red-500/15 border border-red-500/40 text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      {/* Current avatar preview */}
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
          <div className="text-white font-semibold">{displayName}</div>
          {session?.user?.name && (
            <div className="text-brand-muted text-sm">({session.user.name})</div>
          )}
        </div>
      </div>

      {/* Avatar grid */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Select Avatar</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {avatarPool.map((url) => {
            const isSelected = selectedAvatar === url;
            return (
              <button
                key={url}
                onClick={() => setSelectedAvatar(url)}
                className={`relative rounded-full overflow-hidden border-2 transition-all ${
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
                  className="w-full h-full object-cover aspect-square"
                />
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !selectedAvatar || selectedAvatar === session?.user?.avatarUrl}
        className="w-full py-2.5 bg-brand-accent hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
      >
        {saving ? "Saving…" : "Save Avatar"}
      </button>
    </div>
  );
}
