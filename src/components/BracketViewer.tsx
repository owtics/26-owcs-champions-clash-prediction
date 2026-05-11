"use client";

import { useState } from "react";
import Bracket, { BracketProps } from "./Bracket";

/**
 * BracketViewer wraps Bracket with an "Expand Bracket" button
 * that opens a fullscreen overlay for a better viewing experience.
 */
export default function BracketViewer(props: BracketProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-brand-subtext hover:text-white bg-brand-border/40 hover:bg-brand-border/80 px-3 py-1.5 rounded-lg transition-colors"
        >
          Expand Bracket ⤢
        </button>
      </div>
      <Bracket {...props} />

      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border flex-shrink-0">
            <span className="text-white font-bold text-lg">Bracket</span>
            <button
              onClick={() => setExpanded(false)}
              className="text-brand-subtext hover:text-white text-sm bg-brand-card border border-brand-border px-4 py-1.5 rounded-lg transition-colors"
            >
              Close ✕
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <Bracket {...props} />
          </div>
        </div>
      )}
    </>
  );
}
