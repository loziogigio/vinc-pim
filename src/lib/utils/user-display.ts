/**
 * Display helpers for usernames / emails / tenant ids used across the
 * Commerce Suite shell (app bars, account chips, greetings).
 */

/** Two-letter initials from a name / email / id, upper-cased. */
export function initialsOf(value: string): string {
  const base = value.includes("@") ? value.split("@")[0] : value;
  const parts = base.split(/[.\-_\s]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

/** Human-friendly first name from a username / email (falls back to "Admin"). */
export function displayNameOf(username?: string, email?: string): string {
  const raw = username || email || "";
  const base = raw.includes("@") ? raw.split("@")[0] : raw;
  const first = base.split(/[.\-_\s]+/).filter(Boolean)[0] || base;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Admin";
}
