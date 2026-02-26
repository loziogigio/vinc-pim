/**
 * Booking Service
 *
 * Business logic for departures and bookings.
 * All capacity operations use atomic MongoDB findOneAndUpdate.
 */

import { nanoid } from "nanoid";
import { connectWithModels } from "@/lib/db/connection";
import { HOLD_TTL_MS } from "@/lib/constants/booking";
import type { IDeparture, IDepartureResource } from "@/lib/db/models/departure";
import type { IBooking } from "@/lib/db/models/booking";
import type {
  CreateDepartureRequest,
  CreateBookingRequest,
  ConfirmBookingRequest,
  DepartureListFilters,
  BookingListFilters,
  UpdateDepartureRequest,
} from "@/lib/types/booking";

// ============================================
// SERVICE RESULT TYPE
// ============================================

export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// ============================================
// DEPARTURES
// ============================================

/**
 * Create a departure with embedded resources.
 * Validates that parent product exists and is bookable.
 */
export async function createDeparture(
  tenantDb: string,
  tenantId: string,
  input: CreateDepartureRequest
): Promise<ServiceResult<IDeparture>> {
  const { PIMProduct, Departure } = await connectWithModels(tenantDb);

  // Validate parent product exists and is bookable
  const parentProduct = await PIMProduct.findOne({
    entity_code: input.product_entity_code,
    isCurrent: true,
  }).lean();

  if (!parentProduct) {
    return { success: false, error: "Parent product not found", status: 404 };
  }

  const productKind = (parentProduct as Record<string, unknown>).product_kind;
  if (productKind !== "bookable") {
    return {
      success: false,
      error: "Product is not marked as bookable. Set product_kind to 'bookable' first.",
      status: 400,
    };
  }

  // Validate child products exist
  for (const resource of input.resources) {
    const childProduct = await PIMProduct.findOne({
      entity_code: resource.child_entity_code,
      isCurrent: true,
    }).lean();

    if (!childProduct) {
      return {
        success: false,
        error: `Child product not found: ${resource.child_entity_code}`,
        status: 404,
      };
    }
  }

  // Build resources with capacity counters
  const resources: IDepartureResource[] = input.resources.map((r) => ({
    resource_id: nanoid(8),
    resource_type: r.resource_type,
    child_entity_code: r.child_entity_code,
    total_capacity: r.total_capacity,
    available: r.total_capacity, // Initially all available
    held: 0,
    booked: 0,
    price_override: r.price_override,
    currency: r.currency,
  }));

  const departure = await Departure.create({
    departure_id: nanoid(12),
    tenant_id: tenantId,
    product_entity_code: input.product_entity_code,
    label: input.label,
    status: "draft",
    starts_at: new Date(input.starts_at),
    ends_at: input.ends_at ? new Date(input.ends_at) : undefined,
    booking_cutoff_at: input.booking_cutoff_at
      ? new Date(input.booking_cutoff_at)
      : undefined,
    hold_ttl_ms: input.hold_ttl_ms ?? HOLD_TTL_MS,
    resources,
  });

  return { success: true, data: departure as IDeparture };
}

/**
 * Get a single departure by ID.
 */
export async function getDeparture(
  tenantDb: string,
  tenantId: string,
  departureId: string
): Promise<ServiceResult<IDeparture>> {
  const { Departure } = await connectWithModels(tenantDb);

  const departure = await Departure.findOne({
    departure_id: departureId,
    tenant_id: tenantId,
  }).lean<IDeparture>();

  if (!departure) {
    return { success: false, error: "Departure not found", status: 404 };
  }

  return { success: true, data: departure };
}

/**
 * List departures with pagination and filters.
 */
export async function listDepartures(
  tenantDb: string,
  tenantId: string,
  filters: DepartureListFilters
): Promise<ServiceResult<{ departures: IDeparture[]; total: number }>> {
  const { Departure } = await connectWithModels(tenantDb);

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { tenant_id: tenantId };
  if (filters.product_entity_code) {
    query.product_entity_code = filters.product_entity_code;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.date_from || filters.date_to) {
    query.starts_at = {};
    if (filters.date_from) {
      (query.starts_at as Record<string, unknown>).$gte = new Date(filters.date_from);
    }
    if (filters.date_to) {
      (query.starts_at as Record<string, unknown>).$lte = new Date(filters.date_to);
    }
  }

  const [departures, total] = await Promise.all([
    Departure.find(query).sort({ starts_at: -1 }).skip(skip).limit(limit).lean<IDeparture[]>(),
    Departure.countDocuments(query),
  ]);

  return { success: true, data: { departures, total } };
}

/**
 * Update a departure (label, dates, status).
 */
export async function updateDeparture(
  tenantDb: string,
  tenantId: string,
  departureId: string,
  input: UpdateDepartureRequest
): Promise<ServiceResult<IDeparture>> {
  const { Departure } = await connectWithModels(tenantDb);

  const departure = await Departure.findOne({
    departure_id: departureId,
    tenant_id: tenantId,
  });

  if (!departure) {
    return { success: false, error: "Departure not found", status: 404 };
  }

  const updateDoc: Record<string, unknown> = {};
  if (input.label !== undefined) updateDoc.label = input.label;
  if (input.starts_at !== undefined) updateDoc.starts_at = new Date(input.starts_at);
  if (input.ends_at !== undefined) updateDoc.ends_at = new Date(input.ends_at);
  if (input.booking_cutoff_at !== undefined) {
    updateDoc.booking_cutoff_at = new Date(input.booking_cutoff_at);
  }
  if (input.hold_ttl_ms !== undefined) updateDoc.hold_ttl_ms = input.hold_ttl_ms;
  if (input.status !== undefined) updateDoc.status = input.status;

  const updated = await Departure.findOneAndUpdate(
    { departure_id: departureId, tenant_id: tenantId },
    { $set: updateDoc },
    { new: true }
  ).lean<IDeparture>();

  return { success: true, data: updated! };
}

/**
 * Delete a departure. Only allowed for draft departures with no bookings.
 */
export async function deleteDeparture(
  tenantDb: string,
  tenantId: string,
  departureId: string
): Promise<ServiceResult<void>> {
  const { Departure, Booking } = await connectWithModels(tenantDb);

  const departure = await Departure.findOne({
    departure_id: departureId,
    tenant_id: tenantId,
  }).lean<IDeparture>();

  if (!departure) {
    return { success: false, error: "Departure not found", status: 404 };
  }

  if (departure.status !== "draft") {
    return {
      success: false,
      error: "Only draft departures can be deleted",
      status: 400,
    };
  }

  // Check for existing bookings
  const bookingCount = await Booking.countDocuments({
    departure_id: departureId,
    tenant_id: tenantId,
  });

  if (bookingCount > 0) {
    return {
      success: false,
      error: "Cannot delete departure with existing bookings",
      status: 400,
    };
  }

  await Departure.deleteOne({
    departure_id: departureId,
    tenant_id: tenantId,
  });

  return { success: true };
}

// ============================================
// BOOKINGS
// ============================================

/**
 * Atomically hold capacity for a booking.
 *
 * Uses findOneAndUpdate with $elemMatch and $gte guard
 * to prevent overbooking under concurrency.
 * Returns 409 if capacity is insufficient.
 */
export async function holdBooking(
  tenantDb: string,
  tenantId: string,
  input: CreateBookingRequest
): Promise<ServiceResult<IBooking>> {
  const { Departure, Booking, PIMProduct } = await connectWithModels(tenantDb);

  // Fetch departure
  const departure = await Departure.findOne({
    departure_id: input.departure_id,
    tenant_id: tenantId,
  }).lean<IDeparture>();

  if (!departure) {
    return { success: false, error: "Departure not found", status: 404 };
  }

  if (departure.status !== "active") {
    return {
      success: false,
      error: "Departure is not open for booking",
      status: 400,
    };
  }

  // Check booking cutoff
  if (departure.booking_cutoff_at && new Date() > departure.booking_cutoff_at) {
    return {
      success: false,
      error: "Booking cutoff has passed",
      status: 400,
    };
  }

  // Find the target resource
  const resource = departure.resources.find(
    (r) => r.resource_id === input.resource_id
  );
  if (!resource) {
    return { success: false, error: "Resource not found in departure", status: 404 };
  }

  // Determine price: use departure override or PIM product price
  let unitPrice = resource.price_override;
  let currency = resource.currency || "EUR";

  if (unitPrice === undefined) {
    const childProduct = await PIMProduct.findOne({
      entity_code: resource.child_entity_code,
      isCurrent: true,
    })
      .select("pricing")
      .lean();

    const pricing = (childProduct as Record<string, unknown>)?.pricing as
      | { list?: number; currency?: string }
      | undefined;
    unitPrice = pricing?.list ?? 0;
    currency = pricing?.currency || currency;
  }

  // Atomic capacity reservation
  const updated = await Departure.findOneAndUpdate(
    {
      departure_id: input.departure_id,
      tenant_id: tenantId,
      status: "active",
      resources: {
        $elemMatch: {
          resource_id: input.resource_id,
          available: { $gte: input.quantity },
        },
      },
    },
    {
      $inc: {
        "resources.$.available": -input.quantity,
        "resources.$.held": input.quantity,
      },
    },
    { new: true }
  );

  if (!updated) {
    return {
      success: false,
      error: "No capacity available",
      status: 409,
    };
  }

  // Calculate hold expiration
  const holdTtl = input.hold_ttl_ms ?? departure.hold_ttl_ms ?? HOLD_TTL_MS;
  const holdExpiresAt = new Date(Date.now() + holdTtl);

  // Create booking
  const bookingId = nanoid(12);
  const booking = await Booking.create({
    booking_id: bookingId,
    tenant_id: tenantId,
    departure_id: input.departure_id,
    resource_id: input.resource_id,
    child_entity_code: resource.child_entity_code,
    departure_label: departure.label,
    starts_at: departure.starts_at,
    customer_id: input.customer_id,
    quantity: input.quantity,
    unit_price: unitPrice,
    currency,
    total_price: unitPrice * input.quantity,
    status: "held",
    hold_expires_at: holdExpiresAt,
    order_id: input.order_id,
    notes: input.notes,
  });

  // Schedule hold expiry job
  try {
    const { scheduleBookingExpiry } = await import(
      "@/lib/queue/booking-expiry-worker"
    );
    const jobId = await scheduleBookingExpiry(
      tenantDb,
      tenantId,
      bookingId,
      holdTtl
    );
    // Store job ID for cancellation on confirm
    await Booking.updateOne(
      { booking_id: bookingId },
      { $set: { hold_job_id: jobId } }
    );
  } catch {
    // Queue not available (e.g., in tests) — hold still works, just no auto-expiry
    console.warn("Could not schedule booking expiry job — queue may not be available");
  }

  return { success: true, data: booking as IBooking };
}

/**
 * Confirm a held booking.
 * Moves capacity from held → booked and cancels the expiry job.
 */
export async function confirmBooking(
  tenantDb: string,
  tenantId: string,
  bookingId: string,
  options?: ConfirmBookingRequest
): Promise<ServiceResult<IBooking>> {
  const { Departure, Booking } = await connectWithModels(tenantDb);

  const booking = await Booking.findOne({
    booking_id: bookingId,
    tenant_id: tenantId,
  }).lean<IBooking>();

  if (!booking) {
    return { success: false, error: "Booking not found", status: 404 };
  }

  if (booking.status !== "held") {
    return {
      success: false,
      error: `Cannot confirm booking with status '${booking.status}'`,
      status: 400,
    };
  }

  // Atomically move capacity from held → booked
  const updated = await Departure.findOneAndUpdate(
    {
      departure_id: booking.departure_id,
      tenant_id: tenantId,
      resources: {
        $elemMatch: {
          resource_id: booking.resource_id,
          held: { $gte: booking.quantity },
        },
      },
    },
    {
      $inc: {
        "resources.$.held": -booking.quantity,
        "resources.$.booked": booking.quantity,
      },
    },
    { new: true }
  );

  if (!updated) {
    return {
      success: false,
      error: "Failed to update departure capacity",
      status: 500,
    };
  }

  // Update booking status
  const updateDoc: Record<string, unknown> = {
    status: "confirmed",
    confirmed_at: new Date(),
  };
  if (options?.order_id) {
    updateDoc.order_id = options.order_id;
  }

  const confirmedBooking = await Booking.findOneAndUpdate(
    { booking_id: bookingId, tenant_id: tenantId },
    { $set: updateDoc },
    { new: true }
  ).lean<IBooking>();

  // Cancel expiry job
  if (booking.hold_job_id) {
    try {
      const { cancelBookingExpiryJob } = await import(
        "@/lib/queue/booking-expiry-worker"
      );
      await cancelBookingExpiryJob(booking.hold_job_id);
    } catch {
      // Queue not available — non-critical
    }
  }

  return { success: true, data: confirmedBooking! };
}

/**
 * Cancel a booking and return capacity.
 * Works for both held and confirmed bookings.
 */
export async function cancelBooking(
  tenantDb: string,
  tenantId: string,
  bookingId: string,
  cancelledBy: string,
  reason?: string
): Promise<ServiceResult<IBooking>> {
  const { Departure, Booking } = await connectWithModels(tenantDb);

  const booking = await Booking.findOne({
    booking_id: bookingId,
    tenant_id: tenantId,
  }).lean<IBooking>();

  if (!booking) {
    return { success: false, error: "Booking not found", status: 404 };
  }

  if (booking.status !== "held" && booking.status !== "confirmed") {
    return {
      success: false,
      error: `Cannot cancel booking with status '${booking.status}'`,
      status: 400,
    };
  }

  // Return capacity based on current status
  const incUpdate: Record<string, number> = {
    "resources.$.available": booking.quantity,
  };
  if (booking.status === "held") {
    incUpdate["resources.$.held"] = -booking.quantity;
  } else {
    incUpdate["resources.$.booked"] = -booking.quantity;
  }

  await Departure.findOneAndUpdate(
    {
      departure_id: booking.departure_id,
      tenant_id: tenantId,
      "resources.resource_id": booking.resource_id,
    },
    { $inc: incUpdate }
  );

  // Update booking status
  const cancelledBooking = await Booking.findOneAndUpdate(
    { booking_id: bookingId, tenant_id: tenantId },
    {
      $set: {
        status: "cancelled",
        cancelled_at: new Date(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
      },
    },
    { new: true }
  ).lean<IBooking>();

  // Cancel expiry job if was held
  if (booking.status === "held" && booking.hold_job_id) {
    try {
      const { cancelBookingExpiryJob } = await import(
        "@/lib/queue/booking-expiry-worker"
      );
      await cancelBookingExpiryJob(booking.hold_job_id);
    } catch {
      // Queue not available — non-critical
    }
  }

  return { success: true, data: cancelledBooking! };
}

/**
 * Expire a held booking (called by BullMQ worker).
 * Uses { status: "held" } guard to handle race with concurrent confirm.
 */
export async function expireBooking(
  tenantDb: string,
  bookingId: string
): Promise<ServiceResult<IBooking>> {
  const { Departure, Booking } = await connectWithModels(tenantDb);

  // Only expire if still held — guard against race with confirm
  const booking = await Booking.findOneAndUpdate(
    { booking_id: bookingId, status: "held" },
    { $set: { status: "expired" } },
    { new: true }
  ).lean<IBooking>();

  if (!booking) {
    // Already confirmed or cancelled — this is expected, not an error
    return { success: true };
  }

  // Return held capacity to available
  await Departure.findOneAndUpdate(
    {
      departure_id: booking.departure_id,
      "resources.resource_id": booking.resource_id,
    },
    {
      $inc: {
        "resources.$.available": booking.quantity,
        "resources.$.held": -booking.quantity,
      },
    }
  );

  return { success: true, data: booking };
}

/**
 * Get a single booking by ID.
 */
export async function getBooking(
  tenantDb: string,
  tenantId: string,
  bookingId: string
): Promise<ServiceResult<IBooking>> {
  const { Booking } = await connectWithModels(tenantDb);

  const booking = await Booking.findOne({
    booking_id: bookingId,
    tenant_id: tenantId,
  }).lean<IBooking>();

  if (!booking) {
    return { success: false, error: "Booking not found", status: 404 };
  }

  return { success: true, data: booking };
}

/**
 * List bookings with pagination and filters.
 */
export async function listBookings(
  tenantDb: string,
  tenantId: string,
  filters: BookingListFilters
): Promise<ServiceResult<{ bookings: IBooking[]; total: number }>> {
  const { Booking } = await connectWithModels(tenantDb);

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { tenant_id: tenantId };
  if (filters.departure_id) query.departure_id = filters.departure_id;
  if (filters.customer_id) query.customer_id = filters.customer_id;
  if (filters.status) query.status = filters.status;
  if (filters.date_from || filters.date_to) {
    query.starts_at = {};
    if (filters.date_from) {
      (query.starts_at as Record<string, unknown>).$gte = new Date(filters.date_from);
    }
    if (filters.date_to) {
      (query.starts_at as Record<string, unknown>).$lte = new Date(filters.date_to);
    }
  }

  const [bookings, total] = await Promise.all([
    Booking.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean<IBooking[]>(),
    Booking.countDocuments(query),
  ]);

  return { success: true, data: { bookings, total } };
}
