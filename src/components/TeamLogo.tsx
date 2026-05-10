interface TeamLogoProps {
  code: string | null;
  logoUrl?: string | null;
  size?: number; // px, default 22
}

/**
 * Renders a team logo image when logoUrl is provided,
 * or a letter-fallback when it is not.
 * No client-side error handling — server-safe.
 */
export default function TeamLogo({ code, logoUrl, size = 22 }: TeamLogoProps) {
  if (!logoUrl) {
    return (
      <div
        className="rounded-sm bg-brand-border flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <span
          className="font-bold text-brand-subtext leading-none"
          style={{ fontSize: Math.max(7, Math.floor(size * 0.4)) }}
        >
          {code?.charAt(0) ?? "?"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={code ?? ""}
      width={size}
      height={size}
      className="rounded-sm object-contain flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
