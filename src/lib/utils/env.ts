/**
 * Small helpers for reading numeric environment variables safely.
 *
 * Unlike `parseInt(x) || default`, `envInt` treats a valid `0` as `0`
 * (not as falsy → default), and rejects non-numeric junk with a warning.
 */

/**
 * Read an integer env var, falling back to `def` when unset/blank/invalid.
 * A literal `0` is honoured (returns 0), so callers can express "disabled".
 */
export function envInt(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const trimmed = raw.trim();
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || String(n) !== trimmed) {
    console.error(`[env] invalid ${name}="${raw}", using default ${def}`);
    return def;
  }
  return n;
}
