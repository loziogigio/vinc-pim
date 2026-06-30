import type { DataModelField } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";

const FIELDS: DataModelField[] = [
  {
    slug: "default_view",
    label: "Vista predefinita catalogo",
    type: "select",
    options: [
      { value: "grid", label: "Griglia" },
      { value: "list", label: "Lista" },
    ],
  },
  {
    slug: "product_open_mode",
    label: "Apertura prodotto singolo",
    type: "select",
    options: [
      { value: "modal", label: "Modale (anteprima)" },
      { value: "detail_page", label: "Pagina prodotto" },
    ],
  },
  {
    slug: "availability_display",
    label: "Visualizzazione disponibilità",
    type: "select",
    options: [
      { value: "in_out", label: "Solo stato (Disponibile / Non disponibile)" },
      { value: "exact", label: "Numero esatto disponibilità" },
    ],
  },
  {
    slug: "user_exclusion_rules",
    label: "Regole di esclusione utente",
    type: "array_of_objects",
    fields: [
      {
        slug: "enabled",
        label: "Attiva",
        type: "checkbox",
      },
      {
        slug: "user_field",
        label: "Attributo utente",
        type: "select",
        options: [
          { value: "address_country", label: "Paese indirizzo di consegna" },
        ],
      },
      {
        slug: "solr_field",
        label: "Campo Solr di esclusione",
        type: "text",
      },
      {
        slug: "label",
        label: "Nota (facoltativa)",
        type: "text",
      },
    ],
  },
];

/**
 * Channel-scoped catalog UI config consumed by vinc-b2b at runtime via
 *   GET /api/b2b/data-models/catalog_settings/records?channel=<code>
 *
 * Mirrors coupon_settings / cart_settings: `relation: "channel"` → one config
 * record per sales channel (definition channel `"*"`, every record pinned to the
 * sentinel relation_id `_channel`, the record's own `channel` field is the scope
 * key). Holds three enums that drive the time-theme catalog listing:
 *   • `default_view` (grid|list) — initial layout when the shopper hasn't chosen
 *   • `product_open_mode` (modal|detail_page) — single/simple product click goes
 *     to the PRODUCT_VIEW modal or the product detail page; multi-variant always
 *     opens the variants quick-view modal.
 *   • `availability_display` (in_out|exact) — how the time theme renders stock:
 *     just the Disponibile/Non disponibile pill, or the pill plus the exact stock
 *     quantity with its dynamic UOM ("Disponibile · 47 PZ").
 *
 * `readable_by_end_user: false` — read server-side by the storefront resolver
 * (Redis-cached) and re-exposed through the b2b `/api/b2b/catalog-settings`
 * route; the raw record is never sent to the browser.
 *
 * Seed per channel via src/scripts/seed-data-model-catalog-settings.ts. Defaults
 * (grid + modal) match the previous hardcoded behaviour.
 */
export const CATALOG_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "catalog_settings",
  definition: {
    name: "Catalog Settings",
    slug: "catalog_settings",
    relation: "channel",
    cardinality: "single",
    fields: FIELDS,
    readable_by_end_user: false,
    enabled: true,
  },
  defaultRecord: {
    relationId: CHANNEL_RELATION_ID,
    data: {
      default_view: "grid",
      product_open_mode: "modal",
      availability_display: "in_out",
      user_exclusion_rules: [],
    },
  },
};
