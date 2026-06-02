/**
 * BullMQ Queue Configuration
 * Background job processing with Redis
 */

import { Queue } from "bullmq";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");

const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

// Import queue for processing product imports
export const importQueue = new Queue("import-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
    },
  },
});

// Analytics sync queue (future use)
export const analyticsQueue = new Queue("analytics-queue", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

// Marketplace sync queue for Solr, eBay, Amazon, etc.
// Carries INTERACTIVE syncs (single-product publish/edit/unpublish, targeted
// reindexes). Bulk/background catalog backfills go to `syncBulkQueue` instead.
export const syncQueue = new Queue("sync-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // Longer delay for marketplace API rate limits
    },
    removeOnComplete: {
      count: 200, // Keep more sync job history
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

// Isolated lane for import-triggered BULK/background catalog syncs.
// Same Redis + retry options as syncQueue, but drained by a separate,
// low-concurrency worker (see sync-worker.ts) so a huge backfill can never
// starve or saturate the interactive syncs on `sync-queue`.
export const syncBulkQueue = new Queue("sync-bulk-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 200,
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

// FCM Token cleanup queue (runs periodically per tenant)
export const cleanupQueue = new Queue("cleanup-queue", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 60000, // 1 minute retry delay
    },
    removeOnComplete: {
      count: 50, // Keep recent cleanup history
    },
    removeOnFail: {
      count: 100,
    },
  },
});

// PIM version retention queue (prunes old PIMProduct versions per tenant)
export const pimVersionCleanupQueue = new Queue("pim-version-cleanup-queue", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 60000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 100,
    },
  },
});

// Import-job retention queue (prunes old ImportJob/AssociationJob docs per tenant)
export const importJobCleanupQueue = new Queue("import-job-cleanup-queue", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 60000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 100,
    },
  },
});

// Notification scheduler queue (processes scheduled campaigns)
export const notificationQueue = new Queue("notification-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10000, // 10 second initial delay
    },
    removeOnComplete: {
      count: 200, // Keep campaign history
    },
    removeOnFail: {
      count: 500,
    },
  },
});

// Booking hold expiry queue (delayed jobs to expire unheld bookings)
export const bookingExpiryQueue = new Queue("booking-expiry-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 200,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

// Payment processing queue (webhooks, commissions, recurring retries)
export const paymentQueue = new Queue("payment-queue", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 500,
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

// Customer import queue (bulk customer import with tags and addresses)
export const customerImportQueue = new Queue("customer-import-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

// Portal user import queue (bulk portal user import with customer access)
export const portalUserImportQueue = new Queue("portal-user-import-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

// Email queue (transactional emails: order confirmations, password resets, etc.)
export const emailQueue = new Queue("email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

// Export queue names for workers
export const QUEUE_NAMES = {
  IMPORT: "import-queue",
  ANALYTICS: "analytics-queue",
  SYNC: "sync-queue",
  SYNC_BULK: "sync-bulk-queue",
  CLEANUP: "cleanup-queue",
  PIM_VERSION_CLEANUP: "pim-version-cleanup-queue",
  NOTIFICATION: "notification-queue",
  BOOKING_EXPIRY: "booking-expiry-queue",
  PAYMENT: "payment-queue",
  CUSTOMER_IMPORT: "customer-import-queue",
  PORTAL_USER_IMPORT: "portal-user-import-queue",
  EMAIL: "email",
} as const;
