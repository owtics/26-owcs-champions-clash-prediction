"use client";

import { useEffect, useState } from "react";
import { PREDICTION_DEADLINE } from "@/lib/constants";

export default function DeadlineBanner() {
  const [deadline, setDeadline] = useState<Date>(PREDICTION_DEADLINE);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Fetch effective deadline from server (may be overridden by admin)
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => { if (data.deadline) setDeadline(new Date(data.deadline)); })
      .catch(() => {});

    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  const deadlinePassed = now && now >= deadline;

  const formatted = deadline.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });

  if (deadlinePassed) {
    return (
      <div className="bg-brand-red/20 border border-brand-red/50 rounded-lg px-4 py-3 text-center">
        <span className="text-red-400 font-semibold">Prediction Closed</span>
        <span className="text-brand-subtext text-sm ml-2">— Deadline: {formatted}</span>
      </div>
    );
  }

  return (
    <div className="bg-brand-green/10 border border-brand-green/40 rounded-lg px-4 py-3 text-center">
      <span className="text-green-400 font-semibold">Prediction Open</span>
      <span className="text-brand-subtext text-sm ml-2">— Closes: {formatted}</span>
    </div>
  );
}
