/**
 * Cruise constants — companies, cabin categories, CDN paths.
 */

export const CDN_BASE_URL =
  "https://s3.eu-de.cloud-object-storage.appdomain.cloud/vinc-offerte-crociera/media";

export const CRUISE_COMPANIES = {
  msc: { brand_id: "msc", label: "MSC Crociere", slug: "msc" },
  costa: { brand_id: "costa", label: "Costa Crociere", slug: "costa" },
  ncl: { brand_id: "ncl", label: "Norwegian Cruise Line", slug: "ncl" },
  rcg: { brand_id: "rcg", label: "Royal Caribbean", slug: "rcg" },
  celebrity: { brand_id: "celebrity", label: "Celebrity Cruises", slug: "celebrity" },
  azamara: { brand_id: "azamara", label: "Azamara Cruises", slug: "azamara" },
} as const;

export type CruiseCompanyId = keyof typeof CRUISE_COMPANIES;

/** Map OC cabin code prefix → unified category */
export const CABIN_CATEGORY_MAP: Record<string, string> = {
  IR: "interior",
  IB: "interior",
  IF: "interior",
  IG: "interior",
  ID: "interior",
  OB: "ocean_view",
  OW: "ocean_view",
  OF: "ocean_view",
  OV: "ocean_view",
  VM: "ocean_view",
  BL: "balcony",
  BA: "balcony",
  BF: "balcony",
  BP: "balcony",
  SR: "suite",
  SU: "suite",
  SL: "suite",
  SJ: "suite",
  YC: "suite",
  MS: "suite",
  RY: "suite",
  GP: "suite",
};

export const CABIN_CATEGORIES = ["interior", "ocean_view", "balcony", "suite"] as const;

export const CABIN_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  interior: { it: "Interna", en: "Interior" },
  ocean_view: { it: "Vista Mare", en: "Ocean View" },
  balcony: { it: "Balcone", en: "Balcony" },
  suite: { it: "Suite", en: "Suite" },
};

export function cabinCodeToCategory(code: string): string {
  const prefix = code.substring(0, 2).toUpperCase();
  return CABIN_CATEGORY_MAP[prefix] ?? "interior";
}
