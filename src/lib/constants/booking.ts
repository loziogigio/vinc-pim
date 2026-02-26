/**
 * Booking Constants
 *
 * Single source of truth for booking/reservation-related enumerations,
 * status transitions, and helpers.
 * Following the same pattern as order.ts.
 */

import type { UserRole } from "./order";

// ============================================
// PRODUCT KINDS
// ============================================

export const PRODUCT_KINDS = [
  "standard", // Physical or digital product — no booking
  "bookable", // Requires a departure/event instance with capacity
  "service", // Reserved for future use — no specific logic yet
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  standard: "Prodotto Standard",
  bookable: "Prenotabile",
  service: "Servizio",
};

// ============================================
// BOOKING STATUS
// ============================================

export const BOOKING_STATUSES = [
  "held", // Capacity reserved, pending payment — TTL applies
  "confirmed", // Payment received or manually confirmed
  "checked_in", // Customer physically checked in
  "cancelled", // Released — capacity returned
  "expired", // Hold TTL elapsed without confirmation
  "no_show", // Customer did not appear
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  held: "In Attesa di Conferma",
  confirmed: "Confermato",
  checked_in: "Check-in Effettuato",
  cancelled: "Annullato",
  expired: "Scaduto",
  no_show: "Non Presentato",
};

// ============================================
// BOOKING STATUS TRANSITIONS
// ============================================

/**
 * Defines allowed booking status transitions and required roles.
 * Format: { [fromStatus]: { [toStatus]: allowedRoles[] } }
 */
export const BOOKING_STATUS_TRANSITIONS: Record<
  BookingStatus,
  Partial<Record<BookingStatus, UserRole[]>>
> = {
  held: {
    confirmed: ["sales", "admin", "api", "system"],
    cancelled: ["customer", "sales", "admin"],
    expired: ["system"], // BullMQ worker only
  },
  confirmed: {
    checked_in: ["admin", "warehouse"],
    cancelled: ["admin"],
    no_show: ["admin", "warehouse"],
  },
  checked_in: {}, // Terminal
  cancelled: {}, // Terminal
  expired: {}, // Terminal
  no_show: {}, // Terminal
};

// ============================================
// DEPARTURE STATUS
// ============================================

export const DEPARTURE_STATUSES = [
  "draft", // Being configured, not yet bookable
  "active", // Open for booking
  "closed", // No more bookings accepted
  "cancelled", // Departure cancelled
  "completed", // Event has happened
] as const;

export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const DEPARTURE_STATUS_LABELS: Record<DepartureStatus, string> = {
  draft: "Bozza",
  active: "Aperto alle Prenotazioni",
  closed: "Chiuso",
  cancelled: "Annullato",
  completed: "Completato",
};

// ============================================
// RESOURCE TYPES
// ============================================

export const RESOURCE_TYPES = [
  "cabin", // Boat cabins
  "room", // Hotel rooms
  "slot", // Time-slot (showers, appointments)
  "seat", // Seating (bus, theater)
  "generic", // Catch-all
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  cabin: "Cabina",
  room: "Camera",
  slot: "Fascia Oraria",
  seat: "Posto",
  generic: "Generico",
};

// ============================================
// HOLD DEFAULTS
// ============================================

/** Default hold TTL in milliseconds (15 minutes) */
export const HOLD_TTL_MS = 15 * 60 * 1000;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a booking status transition is allowed for a given role.
 */
export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
  userRole: UserRole
): boolean {
  const allowed = BOOKING_STATUS_TRANSITIONS[from]?.[to];
  if (!allowed) return false;
  return allowed.includes(userRole) || allowed.includes("admin");
}

/**
 * Get allowed booking transitions for a given status and role.
 */
export function getAllowedBookingTransitions(
  from: BookingStatus,
  userRole: UserRole
): BookingStatus[] {
  const transitions = BOOKING_STATUS_TRANSITIONS[from];
  if (!transitions) return [];

  return Object.entries(transitions)
    .filter(
      ([_, roles]) =>
        roles?.includes(userRole) || roles?.includes("admin")
    )
    .map(([status]) => status as BookingStatus);
}

/**
 * Check if a booking is in a terminal state (no further transitions possible).
 */
export function isTerminalBookingStatus(status: BookingStatus): boolean {
  return (
    status === "cancelled" ||
    status === "expired" ||
    status === "no_show" ||
    status === "checked_in"
  );
}

/**
 * Check if a booking is active (holding or consuming capacity).
 */
export function isActiveBooking(status: BookingStatus): boolean {
  return status === "held" || status === "confirmed";
}
