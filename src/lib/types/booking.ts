/**
 * Booking Types
 *
 * Request/response interfaces for the booking/reservation API.
 */

import type { BookingStatus, DepartureStatus, ResourceType } from "@/lib/constants/booking";

// ============================================
// DEPARTURE REQUEST/RESPONSE
// ============================================

export interface CreateResourceRequest {
  resource_type: ResourceType;
  /** Child PIM product entity_code (cabin type, room type, etc.) */
  child_entity_code: string;
  total_capacity: number;
  /** Override the PIM product's list price for this departure */
  price_override?: number;
  currency?: string;
}

export interface CreateDepartureRequest {
  /** Parent PIM product entity_code (boat, hotel, facility) */
  product_entity_code: string;
  label: string;
  /** ISO 8601 date string */
  starts_at: string;
  /** ISO 8601 date string */
  ends_at?: string;
  /** Last moment to accept bookings (ISO 8601) */
  booking_cutoff_at?: string;
  /** Override default hold TTL (ms) for this departure */
  hold_ttl_ms?: number;
  resources: CreateResourceRequest[];
}

export interface UpdateDepartureRequest {
  label?: string;
  starts_at?: string;
  ends_at?: string;
  booking_cutoff_at?: string;
  hold_ttl_ms?: number;
  status?: DepartureStatus;
}

export interface DepartureListFilters {
  product_entity_code?: string;
  status?: DepartureStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// ============================================
// BOOKING REQUEST/RESPONSE
// ============================================

export interface CreateBookingRequest {
  departure_id: string;
  resource_id: string;
  customer_id: string;
  quantity: number;
  /** Override hold TTL for this specific booking (ms) */
  hold_ttl_ms?: number;
  /** Link to existing order */
  order_id?: string;
  notes?: string;
}

export interface ConfirmBookingRequest {
  /** Link to order for payment */
  order_id?: string;
}

export interface CancelBookingRequest {
  reason?: string;
}

export interface BookingListFilters {
  departure_id?: string;
  customer_id?: string;
  status?: BookingStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}
