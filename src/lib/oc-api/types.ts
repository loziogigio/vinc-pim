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
