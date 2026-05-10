interface TeamRowProps {
  code: string | null;
  name?: string | null;
  seed?: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isPredicted?: boolean;
  isActualWinner?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export default function TeamRow({
  code,
  name,
  seed,
  isWinner,
  isLoser,
  isPredicted,
  isActualWinner,
  onClick,
  disabled,
}: TeamRowProps) {
  const isTBD = !code;

  let bg = "bg-transparent";
  let border = "border-brand-border";
  let textColor = "text-brand-text";

  if (isPredicted) {
    bg = "bg-brand-accent/20";
    border = "border-brand-accent";
    textColor = "text-white";
  } else if (isActualWinner) {
    bg = "bg-brand-green/15";
    border = "border-brand-green/60";
    textColor = "text-green-300";
  } else if (isLoser) {
    textColor = "text-brand-muted line-through";
  } else if (isTBD) {
    textColor = "text-brand-muted";
  }

  const isClickable = !isTBD && !disabled && !!onClick;

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-1.5 border-t first:border-t-0 ${border}
        ${bg} ${isClickable ? "cursor-pointer hover:bg-brand-accent/10 transition-colors" : ""}
        ${disabled ? "opacity-60" : ""}
      `}
      onClick={isClickable ? onClick : undefined}
    >
      {/* Seed badge */}
      {seed != null && (
        <span className="text-[10px] text-brand-muted w-4 flex-shrink-0">{seed}</span>
      )}

      {/* Logo placeholder */}
      <div className="w-5 h-5 rounded-sm bg-brand-border flex items-center justify-center flex-shrink-0">
        {code && (
          <span className="text-[8px] font-bold text-brand-subtext">
            {code.charAt(0)}
          </span>
        )}
      </div>

      {/* Team code */}
      <span className={`text-sm font-semibold tracking-wide flex-1 ${textColor}`}>
        {code ?? "미정"}
      </span>

      {/* Winner indicator */}
      {isPredicted && (
        <span className="text-[10px] text-brand-accent font-bold">▶</span>
      )}
      {isActualWinner && !isPredicted && (
        <span className="text-[10px] text-green-400 font-bold">✓</span>
      )}
    </div>
  );
}
