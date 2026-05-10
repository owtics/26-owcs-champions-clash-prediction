"use client";

import { useEffect, useState } from "react";
import { PREDICTION_DEADLINE } from "@/lib/constants";

function formatDeadlineKST() {
  return PREDICTION_DEADLINE.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

export default function DeadlineBanner() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  const deadlinePassed = now && now >= PREDICTION_DEADLINE;

  if (deadlinePassed) {
    return (
      <div className="bg-brand-red/20 border border-brand-red/50 rounded-lg px-4 py-3 text-center">
        <span className="text-red-400 font-semibold">예측 마감</span>
        <span className="text-brand-subtext text-sm ml-2">
          — 마감일: {formatDeadlineKST()}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-brand-green/10 border border-brand-green/40 rounded-lg px-4 py-3 text-center">
      <span className="text-green-400 font-semibold">예측 가능</span>
      <span className="text-brand-subtext text-sm ml-2">
        — 마감: {formatDeadlineKST()}
      </span>
    </div>
  );
}
