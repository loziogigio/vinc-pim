import type { DataModelField, DataModelFieldType } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";
import { NOTIFICATION_SETTINGS_FIELDS } from "vinc-notifications";

/**
 * Maps a vinc-notifications field type to a CS DataModelFieldType.
 * "secret" is not in DataModelFieldType until Task 14 — until then fall back
 * to "text" so the admin form can render and persist the value.
 * TODO Task 14: change "secret" mapping to `"secret" as DataModelFieldType`.
 */
function toCsType(t: string): DataModelFieldType {
  return t === "secret" ? "text" : (t as DataModelFieldType);
}

const FIELDS: DataModelField[] = NOTIFICATION_SETTINGS_FIELDS.map((f) => ({
  slug: f.slug,
  label: f.label,
  type: toCsType(f.type),
  ...(f.options
    ? { options: f.options.map((o) => ({ value: o.value, label: o.label })) }
    : {}),
}));

/**
 * Channel-scoped notification backend config consumed by vinc-notifications at
 * runtime via GET /api/b2b/data-models/notification_settings/records?channel=<code>.
 *
 * Covers email (SMTP / Microsoft Graph), SMS (Brevo/Twilio/Vonage), web push
 * (VAPID), and mobile push (FCM). `readable_by_end_user: false` — server-side only.
 * Secret fields (passwords, keys) are stored as plain text until Task 14 adds the
 * masked "secret" input type to the CS admin form.
 */
export const NOTIFICATION_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "notification_settings",
  definition: {
    name: "Notification Settings",
    slug: "notification_settings",
    relation: "channel",
    cardinality: "single",
    fields: FIELDS,
    readable_by_end_user: false,
    enabled: true,
  },
  defaultRecord: {
    relationId: CHANNEL_RELATION_ID,
    data: {
      email_enabled: false,
      sms_enabled: false,
      webpush_enabled: false,
      fcm_enabled: false,
    },
  },
};
