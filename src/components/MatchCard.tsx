import TeamRow from "./TeamRow";

export interface MatchCardTeam {
  code: string | null;
  name?: string | null;
  seed?: number | null;
}

export interface MatchCardProps {
  matchNumber: number;
  roundName: string;
  team1: MatchCardTeam | null;
  team2: MatchCardTeam | null;
  predictedWinner?: string | null;
  actualWinner?: string | null;
  isCorrect?: boolean | null;
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
  onPickWinner,
  disabled,
  showResult,
}: MatchCardProps) {
  const bothTeamsKnown = !!team1?.code && !!team2?.code;

  // Correctness indicator color
  let resultBadge = null;
  if (showResult && isCorrect !== null && isCorrect !== undefined) {
    resultBadge = (
      <span
        className={`absolute top-1 right-2 text-[10px] font-bold ${
          isCorrect ? "text-green-400" : "text-red-400"
        }`}
      >
        {isCorrect ? "+pts" : "✗"}
      </span>
    );
  }

  return (
    <div className="relative flex flex-col w-full bg-brand-card border border-brand-border rounded-lg overflow-hidden shadow-lg group">
      {/* Match header */}
      <div className="bg-brand-border/40 px-3 py-1 flex items-center justify-between">
        <span className="text-[10px] text-brand-subtext font-medium uppercase tracking-widest">
          경기 {matchNumber}
        </span>
        {bothTeamsKnown && !disabled && !predictedWinner && onPickWinner && (
          <span className="text-[9px] text-brand-accent animate-pulse">선택</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex flex-col border-t border-brand-border">
        <TeamRow
          code={team1?.code ?? null}
          seed={team1?.seed ?? null}
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

      {resultBadge}
    </div>
  );
}
