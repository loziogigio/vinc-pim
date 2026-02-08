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

// Export queue names for workers
export const QUEUE_NAMES = {
  IMPORT: "import-queue",
  ANALYTICS: "analytics-queue",
  SYNC: "sync-queue",
  CLEANUP: "cleanup-queue",
  NOTIFICATION: "notification-queue",
  PAYMENT: "payment-queue",
} as const;
