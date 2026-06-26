import type { DataModelField, DataModelFieldType } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";
import { NOTIFICATION_SETTINGS_FIELDS } from "vinc-notifications";

const FIELDS: DataModelField[] = NOTIFICATION_SETTINGS_FIELDS.map((f) => ({
  slug: f.slug,
  label: f.label,
  type: f.type as DataModelFieldType,
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
 * Secret fields (passwords, API keys) use the "secret" type so the admin form
 * renders a masked password input and preserves the stored value when left blank.
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
