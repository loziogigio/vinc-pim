import type { DataModelField } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";

const FIELDS: DataModelField[] = [
  { slug: "linkedin_enabled", label: "LinkedIn — attivo", type: "checkbox" },
  { slug: "linkedin_conversion_rule_id", label: "LinkedIn — Conversion Rule ID", type: "text" },
  { slug: "google_ads_enabled", label: "Google Ads — attivo", type: "checkbox" },
  { slug: "google_ads_conversion_action", label: "Google Ads — Conversion Action", type: "text" },
  { slug: "meta_enabled", label: "Meta — attivo", type: "checkbox" },
  { slug: "meta_pixel_id", label: "Meta — Pixel ID", type: "text" },
  { slug: "ga4_enabled", label: "GA4 — attivo", type: "checkbox" },
  { slug: "ga4_measurement_id", label: "GA4 — Measurement ID", type: "text" },
];

/**
 * Channel-scoped analytics destination config. One record per sales channel
 * (relation: "channel"): which ad-platform destinations are enabled + their
 * PUBLIC ids. Read server-side by the marketing site via
 *   GET /api/b2b/data-models/analytics_settings/records?channel=<code>
 * and used to set RudderStack per-event `integrations`. Secrets (API tokens)
 * stay in rudder-server — only the on/off + public ids live here.
 *
 * `readable_by_end_user: false` — server-side only, never exposed to the browser.
 * Seed per channel via src/scripts/seed-data-model-analytics-settings.ts; toggle
 * a destination on later from the admin at /b2b/admin/data-models/analytics_settings.
 */
export const ANALYTICS_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "analytics_settings",
  definition: {
    name: "Analytics Settings",
    slug: "analytics_settings",
    relation: "channel",
    cardinality: "single",
    fields: FIELDS,
    readable_by_end_user: false,
    enabled: true,
  },
  defaultRecord: {
    relationId: CHANNEL_RELATION_ID,
    data: {
      linkedin_enabled: false,
      linkedin_conversion_rule_id: "",
      google_ads_enabled: false,
      google_ads_conversion_action: "",
      meta_enabled: false,
      meta_pixel_id: "",
      ga4_enabled: false,
      ga4_measurement_id: "",
    },
  },
};
