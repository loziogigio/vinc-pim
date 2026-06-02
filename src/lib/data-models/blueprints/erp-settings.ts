import type { DataModelField } from "@/lib/db/models/data-model-definition";
import type { DataModelBlueprint } from "./types";

const FIELDS: DataModelField[] = [
  {
    slug: "provider",
    label: "Provider ERP",
    type: "select",
    required: true,
    options: [
      { value: "mymb_time", label: "MyMb - Time" },
      // future: add a provider option here (and its client in vinc-erp)
    ],
  },
  {
    slug: "packaging_options_id",
    label: "ID confezioni (in ordine di visualizzazione)",
    type: "text",
  },
  { slug: "is_managed_substitutes", label: "Gestione sostituti", type: "checkbox" },
  { slug: "is_managed_supplier_order", label: "Gestione ordine fornitore", type: "checkbox" },
  {
    slug: "cases",
    label: "Casi disponibilità (label + add to cart)",
    type: "array_of_objects",
    fields: [
      { slug: "case", label: "Caso (0–5)", type: "number", required: true },
      { slug: "label", label: "Etichetta", type: "text", required: true },
      { slug: "add_to_cart", label: "Aggiungibile al carrello", type: "checkbox" },
    ],
  },
  { slug: "update_promo_seconds", label: "TTL cache promo (secondi)", type: "number" },
  {
    slug: "update_available_again_seconds",
    label: "TTL cache 'riordina' (secondi)",
    type: "number",
  },
];

export const ERP_SETTINGS_BLUEPRINT: DataModelBlueprint = {
  id: "erp_settings",
  definition: {
    name: "ERP Settings",
    slug: "erp_settings",
    relation: "customer",
    cardinality: "single",
    fields: FIELDS,
    readable_by_end_user: false, // server-side only — never exposed to the browser
    enabled: true,
  },
  defaultRecord: {
    relationId: "_global",
    data: {
      provider: "mymb_time",
      packaging_options_id: "3,1,2",
      is_managed_substitutes: true,
      is_managed_supplier_order: false,
      cases: [
        { case: 0, label: "Disponibile", add_to_cart: true },
        { case: 1, label: "Sostituto+Arrivo", add_to_cart: true },
        { case: 2, label: "Sostituto", add_to_cart: true },
        { case: 3, label: "In arrivo", add_to_cart: true },
        { case: 4, label: "Non disponibile", add_to_cart: false },
        { case: 5, label: "Non gestito", add_to_cart: false },
      ],
      update_promo_seconds: 21600,
      update_available_again_seconds: 21600,
    },
  },
};
