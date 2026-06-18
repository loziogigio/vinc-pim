// vinc-commerce-suite/src/lib/analytics/emit.ts
import { serverTrack } from "vinc-analytics/server";

/**
 * Fire a server-side RudderStack track event. Config resolution: explicit
 * `config` (from the dynamic pipeline_settings record) → RS env vars. No-ops
 * (returns false, never throws) when neither yields a writeKey + dataPlaneUrl.
 */
export async function emitEvent(
  input: {
    event: string;
    userId?: string;
    anonymousId?: string;
    properties?: Record<string, unknown>;
    context?: Record<string, unknown>;
  },
  config?: { writeKey?: string; dataPlaneUrl?: string }
): Promise<boolean> {
  const writeKey = (config?.writeKey || process.env.RUDDERSTACK_WRITE_KEY || "").trim();
  const dataPlaneUrl = (config?.dataPlaneUrl || process.env.RUDDERSTACK_DATAPLANE_URL || "").trim();
  if (!writeKey || !dataPlaneUrl) return false;
  try {
    return await serverTrack({ writeKey, dataPlaneUrl }, input);
  } catch {
    return false;
  }
}
