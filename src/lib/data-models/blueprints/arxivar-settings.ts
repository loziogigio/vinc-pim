import type { DataModelField } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";

const FIELDS: DataModelField[] = [
  { slug: "enabled", label: "Servizio fatture ArxivarIX attivo", type: "checkbox" },
  { slug: "api_url", label: "URL servizio ArxivarIX (MyMB)", type: "text" },
  { slug: "api_user", label: "Utente servizio ArxivarIX (MyMB)", type: "text" },
  { slug: "api_password", label: "Password servizio ArxivarIX (MyMB)", type: "text" },
];

/**
 * Channel-scoped ArxivarIX invoice-PDF backend config consumed by vinc-b2b at
 * runtime via
 *   GET /api/b2b/data-models/arxivar_settings/records?channel=<code>
 *
 * `relation: "channel"` → one config record per sales channel. Holds `enabled`
 * + `api_url` + the MyMB Basic-auth credentials (`api_user` / `api_password`),
 * so the ArxivarIX connection is fully per-tenant and the storefront container
 * needs no ArxivarIX secrets of its own. The storefront falls back to
 * ARXIVAR_API_USER / ARXIVAR_API_PASSWORD env when the record omits credentials.
 * `readable_by_end_user: false` — server-side only, never exposed to the browser.
 *
 * This is a SEPARATE service from the ERP pricing/orders connection and from
 * `coupon_settings`; it serves fiscal invoice PDFs from ArxivarIX
 * (GetInvoicesFromArxivarIX). Seed per channel via
 * src/scripts/seed-data-model-arxivar-settings.ts.
 */
export const ARXIVAR_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "arxivar_settings",
  definition: {
    name: "ArxivarIX Settings",
    slug: "arxivar_settings",
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
