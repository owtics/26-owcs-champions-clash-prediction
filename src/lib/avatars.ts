/** Allowlist of valid avatar paths. No arbitrary external URLs accepted. */
export const ALLOWED_AVATARS = [
  "/avatars/avatar-1.png",
  "/avatars/avatar-2.png",
  "/avatars/avatar-3.png",
  "/avatars/avatar-4.png",
  "/avatars/avatar-5.png",
  "/avatars/avatar-6.png",
  "/avatars/default.png",
] as const;

/** Returns a random non-default avatar path. */
export function randomAvatar(): string {
  const pool = ALLOWED_AVATARS.slice(0, 6); // exclude default.png
  return pool[Math.floor(Math.random() * pool.length)];
}
