/**
 * Email logs snapshot the resolved `transport_config` (incl. the SMTP password /
 * Graph client secret) into `metadata` so the worker/retry can replay the exact
 * transport. That snapshot must NEVER be serialized back to a client: the logs API
 * and UI only need delivery status, recipient, subject, errors — not credentials.
 *
 * This strips `transport_config` from a (lean) email-log's metadata before it leaves
 * the server. The send/retry path reads the stored doc directly and is unaffected.
 */
export function redactEmailLogSecrets<T extends { metadata?: unknown }>(log: T): T {
  const meta = log?.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return log;
  if (!("transport_config" in (meta as Record<string, unknown>))) return log;
  const rest = { ...(meta as Record<string, unknown>) };
  delete rest.transport_config;
  return { ...log, metadata: rest };
}
