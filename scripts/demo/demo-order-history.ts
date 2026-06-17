/**
 * VINC Demo — order-history data-model definitions + record generators.
 * Definitions are REUSED from the production seeds in src/scripts/seed-data-model-*.ts
 * (single source of truth) so the b2b Riordina/Documenti renderers work unchanged.
 */
import type { IDataModelDefinition } from "../../src/lib/db/models/data-model-definition.js";
import { HISTORICAL_ORDER_DEFINITION } from "../../src/scripts/seed-data-model-historical-order.js";
import { INVOICE_DEFINITION } from "../../src/scripts/seed-data-model-invoice.js";
import { DELIVERY_NOTE_DEFINITION } from "../../src/scripts/seed-data-model-delivery-note.js";
import { CREDIT_EXPOSURE_DEFINITION } from "../../src/scripts/seed-data-model-credit-exposure.js";

export type Def = Omit<IDataModelDefinition, "_id" | "created_at" | "updated_at">;

// Reused as-is. If a future demo needs channel "*" or different flags, spread
// and override here — e.g. { ...HISTORICAL_ORDER_DEFINITION, channel: "*" }.
export const ORDER_HISTORY_DEFINITIONS: Def[] = [
  HISTORICAL_ORDER_DEFINITION,
  INVOICE_DEFINITION,
  DELIVERY_NOTE_DEFINITION,
  CREDIT_EXPOSURE_DEFINITION,
];
