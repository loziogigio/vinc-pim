import { channelStatus, type ChannelKind, type ChannelState } from "@/lib/notifications/channel-status";

export function composeStatus(
  data: Record<string, unknown>,
  fallback: { emailFallback: boolean; fcmFallback: boolean },
): Record<ChannelKind, { enabled: boolean; state: ChannelState }> {
  const base = channelStatus(data);
  if (fallback.emailFallback && base.email.state !== "configured") {
    base.email = { enabled: true, state: "configured" };
  }
  if (fallback.fcmFallback && base.fcm.state !== "configured") {
    base.fcm = { enabled: true, state: "configured" };
  }
  return base;
}
