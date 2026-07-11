import { NOTIFICATION_SETTINGS_FIELDS, type NotificationFieldDescriptor } from "vinc-notifications";
import { SECRET_MASK } from "@/lib/data-models/redact-secrets";

export type ChannelKind = "email" | "sms" | "webpush" | "fcm";
export type ChannelState = "off" | "incomplete" | "configured";

/** Slug prefixes that belong to each channel group. Order matters: first match wins. */
const GROUP_PREFIXES: Record<ChannelKind, string[]> = {
  email: ["email_", "smtp_", "graph_"],
  sms: ["sms_"],
  webpush: ["webpush_"],
  fcm: ["fcm_"],
};

export function channelFieldGroups(): Record<ChannelKind, NotificationFieldDescriptor[]> {
  const groups: Record<ChannelKind, NotificationFieldDescriptor[]> = {
    email: [], sms: [], webpush: [], fcm: [],
  };
  const kinds = Object.keys(GROUP_PREFIXES) as ChannelKind[];
  for (const field of NOTIFICATION_SETTINGS_FIELDS) {
    const kind = kinds.find((k) => GROUP_PREFIXES[k].some((p) => field.slug.startsWith(p)));
    if (kind) groups[kind].push(field);
  }
  return groups;
}

function present(v: unknown): boolean {
  return v === SECRET_MASK || (typeof v === "string" ? v.trim() !== "" : Boolean(v));
}

function state(enabled: boolean, complete: boolean): { enabled: boolean; state: ChannelState } {
  if (!enabled) return { enabled: false, state: "off" };
  return { enabled: true, state: complete ? "configured" : "incomplete" };
}

export function channelStatus(
  data: Record<string, unknown>,
): Record<ChannelKind, { enabled: boolean; state: ChannelState }> {
  const emailComplete =
    data.email_transport === "graph" ? present(data.graph_azure_tenant_id) : present(data.smtp_host);
  return {
    email: state(Boolean(data.email_enabled), emailComplete),
    sms: state(Boolean(data.sms_enabled), present(data.sms_sender_id) && present(data.sms_api_key)),
    webpush: state(
      Boolean(data.webpush_enabled),
      present(data.webpush_vapid_public_key) && present(data.webpush_vapid_private_key),
    ),
    fcm: state(
      Boolean(data.fcm_enabled),
      present(data.fcm_project_id) && present(data.fcm_client_email) && present(data.fcm_private_key),
    ),
  };
}
