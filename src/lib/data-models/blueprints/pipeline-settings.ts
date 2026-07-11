import type { DataModelField } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";

export const PIPELINE_SETTINGS_FIELDS: DataModelField[] = [
  { slug: "twenty_base_url", label: "Twenty CRM — Base URL", type: "text" },
  { slug: "twenty_api_key", label: "Twenty CRM — API Key", type: "text" },
  { slug: "twenty_webhook_secret", label: "Twenty CRM — Webhook Secret", type: "text" },
  { slug: "rudderstack_write_key", label: "RudderStack — Write Key", type: "text" },
  { slug: "rudderstack_dataplane_url", label: "RudderStack — Data Plane URL", type: "text" },
];

/**
 * Channel-scoped selling-machine pipeline config (Twenty CRM + RudderStack),
 * read server-side by the CS lead pipeline at runtime with per-field ENV
 * fallback (see resolvePipelineSettings). One record per channel
 * (relation: "channel" → definition channel "*", relation_id sentinel
 * "_channel"); the record's own `channel` field is the scope key (default
 * "default"). `readable_by_end_user: false` — holds secrets, server-side only.
 *
 * NOTE: `VINC_PIPELINE_TENANT_ID` stays an ENV var (bootstrap): it names the
 * tenant DB this very record lives in, so it cannot itself be dynamic. Seed
 * via src/scripts/seed-data-model-pipeline-settings.ts; edit values in the CS
 * admin data-model editor. Empty fields fall back to env at runtime.
 */
export const PIPELINE_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "pipeline_settings",
  definition: {
    name: "Pipeline Settings",
    slug: "pipeline_settings",
    relation: "channel",
    cardinality: "single",
    fields: PIPELINE_SETTINGS_FIELDS,
    readable_by_end_user: false,
    enabled: true,
  },
  defaultRecord: {
    relationId: CHANNEL_RELATION_ID,
    data: {},
  },
};
