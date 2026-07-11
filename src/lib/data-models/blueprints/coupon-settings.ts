import type { DataModelField } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";

const FIELDS: DataModelField[] = [
  { slug: "enabled", label: "Coupon attivi", type: "checkbox" },
  { slug: "api_url", label: "URL servizio coupon (MyMB)", type: "text" },
  { slug: "api_user", label: "Utente servizio coupon (MyMB)", type: "text" },
  { slug: "api_password", label: "Password servizio coupon (MyMB)", type: "text" },
];

/**
 * Channel-scoped coupon backend config consumed by vinc-b2b at runtime via
 *   GET /api/b2b/data-models/coupon_settings/records?channel=<code>
 *
 * `relation: "channel"` → one config record per sales channel: the definition
 * applies to all channels (channel `"*"`), every record is pinned to the
 * sentinel relation_id `_channel`, and the record's own `channel` field is the
 * scope key. Holds `enabled` + `api_url` + the MyMB Basic-auth credentials
 * (`api_user` / `api_password`) so the configuration is fully per-tenant and the
 * storefront container needs no coupon secrets of its own. The storefront still
 * falls back to COUPON_API_USER / COUPON_API_PASSWORD env when the record omits
 * the credentials. `readable_by_end_user: false` — server-side only.
 *
 * Seed per channel via src/scripts/seed-data-model-coupon-settings.ts. Note the
 * generic install route is not channel-aware; this blueprint is meant for the
 * seed script or the admin (which normalizes channel models on create).
 */
export const COUPON_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "coupon_settings",
  definition: {
    name: "Coupon Settings",
    slug: "coupon_settings",
    relation: "channel",
    cardinality: "single",
    fields: FIELDS,
    readable_by_end_user: false,
    enabled: true,
  },
  defaultRecord: {
    relationId: CHANNEL_RELATION_ID,
    data: { enabled: false, api_url: "" },
  },
};
