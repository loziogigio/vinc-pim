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

// ---------------------------------------------------------------------------
// Record generators — deterministic 8-month order history
// ---------------------------------------------------------------------------

/** The runtime relation_id is the ERP customer code = customer.external_code. */
const B2B_CODES = ["DEMO-C01", "DEMO-C02"] as const;
const iso = (d: Date) => d.toISOString();
const monthsAgo = (now: Date, n: number) => new Date(now.getFullYear(), now.getMonth() - n, 14, 10, 0, 0);

export interface DemoRecord {
  slug: string;
  relation_id: string;
  channel: "b2b";
  external_ref: string;
  data: Record<string, unknown>;
}

export function buildOrderHistoryRecords(now: Date = new Date()): DemoRecord[] {
  const out: DemoRecord[] = [];
  B2B_CODES.forEach((cust, ci) => {
    let exposure = 0;
    for (let m = 1; m <= 8; m++) {
      const dt = monthsAgo(now, m);
      const seq = `${ci + 1}${String(m).padStart(2, "0")}`;
      const subtotal = 250 + m * 37 + ci * 60;
      const vat = +(subtotal * 0.22).toFixed(2);
      const total = +(subtotal + vat).toFixed(2);
      exposure += total;
      const items = [
        { line_number: 1, sku: "DEMO-FIS-01", entity_code: "DEMO-FIS-01", name: "Viti autofilettanti 4×40", quantity: 2, uom: "BOX", unit_price: 8.0, vat_rate: 22, line_total: 16.0 },
        { line_number: 2, sku: "DEMO-UMA-01", entity_code: "DEMO-UMA-01", name: "Set chiavi combinate 12 pz", quantity: 1, uom: "PZ", unit_price: 18.7, vat_rate: 22, line_total: 18.7 },
      ];
      out.push({ slug: "historical_order", relation_id: cust, channel: "b2b", external_ref: `ORD/2026/${seq}`,
        data: { document_number: `ORD/2026/${seq}`, document_date: iso(dt), status: "invoiced", currency: "EUR",
          subtotal, vat_total: vat, total, items } });
      out.push({ slug: "invoice", relation_id: cust, channel: "b2b", external_ref: `FT/2026/${seq}`,
        data: { numero_fattura: `FT/2026/${seq}`, numero_documento: `ORD/2026/${seq}`, data: iso(dt),
          imponibile: subtotal, iva: vat, totale: total, valuta: "EUR",
          pdf_url: `https://cdn.vendereincloud.it/vinc-demo-it/demo/docs/FT-2026-${seq}.pdf` } });
      out.push({ slug: "delivery_note", relation_id: cust, channel: "b2b", external_ref: `DDT/2026/${seq}`,
        data: { numero_ddt: `DDT/2026/${seq}`, numero_documento: `ORD/2026/${seq}`, data: iso(dt),
          corriere: "Demo Express", totale: total, numero_fattura_collegata: `FT/2026/${seq}`, items } });
    }
    const snap = iso(monthsAgo(now, 1));
    const fido = 5000 + ci * 2000;
    out.push({ slug: "credit_exposure", relation_id: cust, channel: "b2b", external_ref: snap,
      data: { snapshot_date: snap, currency: "EUR",
        lines: [{ code: "FATT", label: "Fatture", scaduto: 0, da_scadere: +exposure.toFixed(2), totale: +exposure.toFixed(2) }],
        scaduto_totale: 0, da_scadere_totale: +exposure.toFixed(2),
        totale_esposizione: +exposure.toFixed(2), fido_assicurato: fido,
        differenza: +(fido - exposure).toFixed(2) } });
  });
  return out;
}
