export interface OCPerPaxPrice {
  pax_no: number;
  type: string;
  amount: string; // Decimal serialized as string by OC
}

export interface OCAvailabilityPrice {
  currency: string;
  per_pax: OCPerPaxPrice[];
  total_gross: string;
  taxes: string;
  commission: string; // operator-only — never forwarded to customers
}

export interface OCAvailability {
  source: string;
  oc_cruise_id: number;
  category: string;
  available: boolean;
  cabins_available: number;
  guarantees_available: number;
  price_code: string;
  price: OCAvailabilityPrice;
}

export interface OCAvailabilityRequest {
  oc_cruise_id: number;
  category: string;
  adults: number;
  children: number;
}

// ============================================
// Booking-option gateway (quotes → book → cancel)
// ============================================

export interface OCCreateQuoteRequest {
  cruise_id: number;
  cabin_type_id: number;
  price_type_id: number;
  num_adults: number;
  num_children: number;
}

export interface OCQuote {
  uuid: string;
  pratica: number;
}

export interface OCPassenger {
  person_no: number;
  first_name: string;
  last_name: string;
  date_of_birth: string; // ISO date string, e.g. "1985-01-01"
  gender: string; // "M" | "F"
  person_type: string; // "ADT" | "CHD" | ...
  nationality: string; // 3-letter code, e.g. "ITA"
}

export interface OCOrder {
  uuid: string;
  status: number;
  offline: boolean;
  cabin_no: string | null;
  msc_booking_no: string | null;
}

// ============================================
// Catalog (public, no gateway key required) — used to resolve
// cabin_type_id/price_type_id from a cabin category code when the
// quotation snapshot doesn't already carry them.
// ============================================

export interface OCCatalogCabinType {
  code: string;
  name: string;
  category: string | null;
}

export interface OCCatalogPrice {
  cabin_type_id: number;
  price_type_id: number;
  cabin_type: OCCatalogCabinType;
  price_type: string;
  price_per_person: number;
  currency: string;
}

export interface OCCatalogCruise {
  prices: OCCatalogPrice[];
}
