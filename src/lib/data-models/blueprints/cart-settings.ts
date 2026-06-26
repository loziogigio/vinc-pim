import type { DataModelField } from "@/lib/db/models/data-model-definition";
import { CHANNEL_RELATION_ID } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";

const FIELDS: DataModelField[] = [
  { slug: "show_line_note", label: "Mostra nota di riga (carrello)", type: "checkbox" },
  { slug: "show_head_note", label: "Mostra nota di testata (ordine)", type: "checkbox" },
  { slug: "show_pickup", label: "Mostra ritiro (consegna)", type: "checkbox" },
];

/**
 * Channel-scoped cart UI config consumed by vinc-b2b at runtime via
 *   GET /api/b2b/data-models/cart_settings/records?channel=<code>
 *
 * Mirrors coupon_settings: `relation: "channel"` → one config record per sales
 * channel (definition applies to all channels via channel `"*"`, every record is
 * pinned to the sentinel relation_id `_channel`, the record's own `channel` field
 * is the scope key). Holds three booleans that toggle the per-line note input
 * (`show_line_note`), the order head note textarea (`show_head_note`), and the
 * "Ritiro" (pickup) delivery option (`show_pickup`) in the time-theme
 * cart/checkout, so the storefront can switch them on/off per channel without a
 * redeploy.
 *
 * `readable_by_end_user: false` — read server-side by the storefront resolver
 * (Redis-cached) and re-exposed through the b2b `/api/b2b/cart-settings` route;
 * the raw record is never sent to the browser.
 *
 * Seed per channel via src/scripts/seed-data-model-cart-settings.ts. Both notes
 * default to OFF and pickup to ON, matching the previous hardcoded behaviour
 * (notes hidden, pickup always shown).
 */
export const CART_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "cart_settings",
  definition: {
    name: "Cart Settings",
    slug: "cart_settings",
    relation: "channel",
    cardinality: "single",
    fields: FIELDS,
    readable_by_end_user: false,
    enabled: true,
  },
  defaultRecord: {
    relationId: CHANNEL_RELATION_ID,
    data: { show_line_note: false, show_head_note: false, show_pickup: true },
  },
};
