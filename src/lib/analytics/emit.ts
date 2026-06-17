// vinc-commerce-suite/src/lib/analytics/emit.ts
import { serverTrack } from "vinc-analytics/server";

/** Fire a server-side RudderStack track event. No-ops (returns false) if RS env is unset. */
export async function emitEvent(input: {
  event: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
}): Promise<boolean> {
  const writeKey = process.env.RUDDERSTACK_WRITE_KEY ?? "";
  const dataPlaneUrl = process.env.RUDDERSTACK_DATAPLANE_URL ?? "";
  if (!writeKey || !dataPlaneUrl) return false;
  try {
    return await serverTrack({ writeKey, dataPlaneUrl }, input);
  } catch {
    return false;
  }
}
