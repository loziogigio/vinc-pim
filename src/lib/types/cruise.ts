/**
 * Cruise-specific types for the offerte-crociere integration.
 *
 * These type the `metadata` field on Departures and define
 * the shape of cruise reference data synced from OC.
 */

export interface CruiseItineraryPort {
  day: number;
  port: string;
  country_code: string | null;
  arrival: string | null;
  departure: string | null;
  sort_order: number;
}

export interface CruiseDepartureMetadata {
  oc_cruise_id: number;
  destination_area: string;
  departure_port: string;
  return_port?: string;
  duration_nights: number;
  itinerary: CruiseItineraryPort[];
  map_image_url?: string;
  booking_url?: string;
  immediate_confirm: boolean;
  image_url?: string;
}

export type CabinCategoryCode = "interior" | "ocean_view" | "balcony" | "suite";

export interface OCFlatCruiseSync {
  cruise_id: number;
  source: string;
  company: { id: number; name: string; short_name: string };
  ship: { id: number; name: string; code: string };
  departure_date: string;
  return_date: string;
  duration_nights: number;
  departure_port: string;
  destination_area: string;
  ports: Array<{
    name: string;
    country_code: string | null;
    arrival: string | null;
    departure: string | null;
    sort_order: number;
  }>;
  prices: Array<{
    cabin_type: { code: string; name: string; category: string | null };
    price_per_person: number;
    currency: string;
    availability: number | null;
  }>;
  booking_url: string | null;
  image_url: string | null;
  active: boolean;
  immediate_confirm: boolean;
}
