/**
 * Booking Hold Expiry Worker
 *
 * Processes delayed jobs to expire held bookings that were not confirmed.
 * When a hold expires, capacity is returned to the departure's available pool.
 */

import { Worker, Job } from "bullmq";
import { expireBooking } from "@/lib/services/booking.service";

// ============================================
// JOB DATA TYPES
// ============================================

export interface BookingExpiryJobData {
  tenant_db: string;
  tenant_id: string;
  booking_id: string;
}

export interface BookingExpiryJobResult {
  booking_id: string;
  tenant_id: string;
  expired: boolean;
  error?: string;
}

// ============================================
// JOB PROCESSOR
// ============================================

async function processBookingExpiryJob(
  job: Job<BookingExpiryJobData>
): Promise<BookingExpiryJobResult> {
  const { tenant_db, tenant_id, booking_id } = job.data;

  console.log(`[Booking Expiry] Processing: ${booking_id} (tenant: ${tenant_id})`);

  try {
    const result = await expireBooking(tenant_db, booking_id);

    if (result.success && result.data) {
      console.log(`[Booking Expiry] Expired: ${booking_id} — capacity returned`);
      return { booking_id, tenant_id, expired: true };
    }

    // No data means booking was already confirmed/cancelled — not an error
    console.log(`[Booking Expiry] Skipped: ${booking_id} — no longer held`);
    return { booking_id, tenant_id, expired: false };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Booking Expiry] Failed: ${booking_id} — ${errorMsg}`);
    return { booking_id, tenant_id, expired: false, error: errorMsg };
  }
}

// ============================================
// WORKER CONFIGURATION
// ============================================

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

export const bookingExpiryWorker = new Worker(
  "booking-expiry-queue",
  processBookingExpiryJob,
  {
    connection: {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    concurrency: 5,
  }
);

// ============================================
// EVENT LISTENERS
// ============================================

bookingExpiryWorker.on("completed", (job, result: BookingExpiryJobResult) => {
  if (result.expired) {
    console.log(
      `[Booking Expiry] Job ${job.id} completed — booking ${result.booking_id} expired`
    );
  }
});

bookingExpiryWorker.on("failed", (job, err) => {
  console.error(`[Booking Expiry] Job ${job?.id} failed:`, err.message);
});

// ============================================
// HELPERS: Schedule & Cancel
// ============================================

/**
 * Schedule a delayed job to expire a booking hold.
 * Returns the BullMQ job ID for later cancellation.
 */
export async function scheduleBookingExpiry(
  tenantDb: string,
  tenantId: string,
  bookingId: string,
  ttlMs: number
): Promise<string> {
  const { bookingExpiryQueue } = await import("./queues");

  const job = await bookingExpiryQueue.add(
    `expire-${bookingId}`,
    {
      tenant_db: tenantDb,
      tenant_id: tenantId,
      booking_id: bookingId,
    },
    {
      delay: ttlMs,
      jobId: `booking-expiry-${bookingId}`,
      removeOnComplete: true,
    }
  );

  return job.id!;
}

/**
 * Cancel a scheduled expiry job (on confirm or manual cancel).
 */
export async function cancelBookingExpiryJob(jobId: string): Promise<void> {
  const { bookingExpiryQueue } = await import("./queues");

  try {
    const job = await bookingExpiryQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch {
    // Job may have already been processed or removed — non-critical
  }
}
