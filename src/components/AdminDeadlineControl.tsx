"use client";

import { useState, useEffect } from "react";

export default function AdminDeadlineControl() {
  const [deadlineInput, setDeadlineInput] = useState("");
  const [currentDeadline, setCurrentDeadline] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.deadline) {
          setCurrentDeadline(data.deadline);
          // Convert ISO UTC → datetime-local format (local browser time)
          const d = new Date(data.deadline);
          const pad = (n: number) => String(n).padStart(2, "0");
          setDeadlineInput(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!deadlineInput) return;
    setSaving(true);
    setMessage(null);

    // datetime-local is in local browser time — convert to UTC ISO string
    const d = new Date(deadlineInput);
    if (isNaN(d.getTime())) {
      setMessage({ type: "err", text: "Invalid date/time." });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline: d.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save deadline.");
      setCurrentDeadline(data.deadline);
      setMessage({ type: "ok", text: "Deadline updated successfully." });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const formattedCurrent = currentDeadline
    ? new Date(currentDeadline).toLocaleString("en-US", {
        timeZone: "Asia/Seoul",
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
        hour12: false, timeZoneName: "short",
      })
    : null;

  return (
    <div className="space-y-4">
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          message.type === "ok"
            ? "bg-green-500/15 border border-green-500/40 text-green-400"
            : "bg-red-500/15 border border-red-500/40 text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      {formattedCurrent && (
        <p className="text-sm text-brand-subtext">
          Current deadline: <span className="text-white font-medium">{formattedCurrent}</span>
        </p>
      )}

      {loading ? (
        <p className="text-brand-muted text-sm">Loading…</p>
      ) : (
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-brand-subtext mb-1.5">
              New deadline (your local time)
            </label>
            <input
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !deadlineInput}
            className="px-5 py-2 bg-brand-accent hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {saving ? "Saving…" : "Update Deadline"}
          </button>
        </div>
      )}

      <p className="text-xs text-brand-muted">
        The deadline is stored in UTC and enforced server-side. All users will see the updated deadline immediately.
      </p>
    </div>
  );
}
