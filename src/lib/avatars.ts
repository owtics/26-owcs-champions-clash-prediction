/** Allowlist of valid avatar paths. No arbitrary external URLs accepted. */
export const ALLOWED_AVATARS: readonly string[] = [
  "/avatars/avatar-1.png",  "/avatars/avatar-2.png",  "/avatars/avatar-3.png",
  "/avatars/avatar-4.png",  "/avatars/avatar-5.png",  "/avatars/avatar-6.png",
  "/avatars/avatar-7.png",  "/avatars/avatar-8.png",  "/avatars/avatar-9.png",
  "/avatars/avatar-10.png", "/avatars/avatar-11.png", "/avatars/avatar-12.png",
  "/avatars/avatar-13.png", "/avatars/avatar-14.png", "/avatars/avatar-15.png",
  "/avatars/avatar-16.png", "/avatars/avatar-17.png", "/avatars/avatar-18.png",
  "/avatars/avatar-19.png", "/avatars/avatar-20.png", "/avatars/avatar-21.png",
  "/avatars/avatar-22.png", "/avatars/avatar-23.png", "/avatars/avatar-24.png",
  "/avatars/avatar-25.png", "/avatars/avatar-26.png", "/avatars/avatar-27.png",
  "/avatars/avatar-28.png", "/avatars/avatar-29.png", "/avatars/avatar-30.png",
  "/avatars/avatar-31.png", "/avatars/avatar-32.png", "/avatars/avatar-33.png",
  "/avatars/avatar-34.png", "/avatars/avatar-35.png", "/avatars/avatar-36.png",
  "/avatars/avatar-37.png", "/avatars/avatar-38.png", "/avatars/avatar-39.png",
  "/avatars/avatar-40.png", "/avatars/avatar-41.png", "/avatars/avatar-42.png",
  "/avatars/avatar-43.png", "/avatars/avatar-44.png", "/avatars/avatar-45.png",
  "/avatars/avatar-46.png", "/avatars/avatar-47.png", "/avatars/avatar-48.png",
  "/avatars/avatar-49.png",
  "/avatars/default.png",
];

/** Returns a random non-default avatar path from the first 49. */
export function randomAvatar(): string {
  const pool = ALLOWED_AVATARS.slice(0, 49);
  return pool[Math.floor(Math.random() * pool.length)];
}
