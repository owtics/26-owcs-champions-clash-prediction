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
  roundName,
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

  // Border color based on result correctness
  let borderClass = "border-brand-border";
  if (showResult && actualWinner) {
    if (isCorrect === true)  borderClass = "border-green-500";
    else if (isCorrect === false) borderClass = "border-red-500";
  }

  // Result badge in header
  let scoreBadge: React.ReactNode = null;
  if (showResult) {
    if (!actualWinner) {
      scoreBadge = (
        <span className="text-[9px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded font-medium">
          대기
        </span>
      );
    } else if (isCorrect === true) {
      scoreBadge = (
        <span className="text-[9px] text-green-400 font-bold">
          적중 +{pointsAwarded ?? 0}점/{maxPoints ?? 0}점
        </span>
      );
    } else {
      scoreBadge = (
        <span className="text-[9px] text-red-400 font-bold">
          실패 0점/{maxPoints ?? 0}점
        </span>
      );
    }
  }

  return (
    <div className={`relative flex flex-col w-full bg-brand-card border ${borderClass} rounded-lg overflow-hidden shadow-lg group`}>
      {/* Match header */}
      <div className="bg-brand-border/40 px-3 py-1 flex items-center justify-between">
        <span className="text-[10px] text-brand-subtext font-medium uppercase tracking-widest">
          경기 {matchNumber}
        </span>
        <div className="flex items-center gap-1">
          {scoreBadge}
          {bothTeamsKnown && !disabled && !predictedWinner && onPickWinner && !showResult && (
            <span className="text-[9px] text-brand-accent animate-pulse">선택</span>
          )}
        </div>
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
