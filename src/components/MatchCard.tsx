import TeamRow from "./TeamRow";

export interface MatchCardTeam {
  code: string | null;
  name?: string | null;
  seed?: number | null;
  logoUrl?: string | null;
}

export interface MatchCardProps {
  matchNumber: number;
  roundName: string;
  team1: MatchCardTeam | null;
  team2: MatchCardTeam | null;
  predictedWinner?: string | null;
  actualWinner?: string | null;
  isCorrect?: boolean | null;
  pointsAwarded?: number | null;
  maxPoints?: number | null;
  onPickWinner?: (teamCode: string) => void;
  disabled?: boolean;
  showResult?: boolean;
}

export default function MatchCard({
  matchNumber,
  team1,
  team2,
  predictedWinner,
  actualWinner,
  isCorrect,
  pointsAwarded,
  maxPoints,
  onPickWinner,
  disabled,
  showResult,
}: MatchCardProps) {
  const bothTeamsKnown = !!team1?.code && !!team2?.code;

  // Border color based on result
  let borderClass = "border-brand-border";
  if (showResult && actualWinner) {
    if (isCorrect === true)  borderClass = "border-[#10B981]/60";
    else if (isCorrect === false) borderClass = "border-red-500/60";
  }

  // Full-width status strip at top of card
  let statusStrip: React.ReactNode = null;
  if (showResult) {
    if (!actualWinner) {
      statusStrip = (
        <div className="flex items-center px-2 py-[3px] bg-zinc-800">
          <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
            PENDING
          </span>
        </div>
      );
    } else if (isCorrect === true) {
      statusStrip = (
        <div className="flex items-center justify-between px-2 py-[3px]" style={{ backgroundColor: "#14B8A6" }}>
          <span className="text-[9px] font-bold tracking-widest text-white uppercase">
            CORRECT
          </span>
          <span className="text-[9px] font-bold text-white">
            +{pointsAwarded ?? 0} PTS
          </span>
        </div>
      );
    } else {
      statusStrip = (
        <div className="flex items-center justify-between px-2 py-[3px] bg-red-700">
          <span className="text-[9px] font-bold tracking-widest text-white uppercase">
            INCORRECT
          </span>
          <span className="text-[9px] font-bold text-white">+0 PTS</span>
        </div>
      );
    }
  }

  return (
    <div
      className={`relative flex flex-col w-full bg-brand-card border ${borderClass} rounded-lg overflow-hidden shadow-lg group`}
    >
      {/* Status strip — only rendered in result mode */}
      {statusStrip}

      {/* Match header */}
      <div className="bg-brand-border/40 px-2 py-1 flex items-center justify-between">
        <span className="text-[9px] text-brand-subtext font-medium uppercase tracking-widest">
          Match {matchNumber}
        </span>
        {bothTeamsKnown && !disabled && !predictedWinner && onPickWinner && !showResult && (
          <span className="text-[9px] text-brand-accent animate-pulse">Pick</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex flex-col border-t border-brand-border">
        <TeamRow
          code={team1?.code ?? null}
          seed={team1?.seed ?? null}
          logoUrl={team1?.logoUrl ?? null}
          isWinner={predictedWinner === team1?.code}
          isLoser={!!predictedWinner && predictedWinner !== team1?.code}
          isPredicted={predictedWinner === team1?.code}
          isActualWinner={showResult && actualWinner === team1?.code}
          onClick={
            onPickWinner && team1?.code && bothTeamsKnown
              ? () => onPickWinner(team1.code!)
              : undefined
          }
          disabled={disabled || !bothTeamsKnown}
        />
        <TeamRow
          code={team2?.code ?? null}
          seed={team2?.seed ?? null}
          logoUrl={team2?.logoUrl ?? null}
          isWinner={predictedWinner === team2?.code}
          isLoser={!!predictedWinner && predictedWinner !== team2?.code}
          isPredicted={predictedWinner === team2?.code}
          isActualWinner={showResult && actualWinner === team2?.code}
          onClick={
            onPickWinner && team2?.code && bothTeamsKnown
              ? () => onPickWinner(team2.code!)
              : undefined
          }
          disabled={disabled || !bothTeamsKnown}
        />
      </div>
    </div>
  );
}
