/**
 * Bull Board Configuration
 * Web UI for monitoring BullMQ queues
 */

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import {
  importQueue,
  analyticsQueue,
  syncQueue,
  cleanupQueue,
  notificationQueue,
  bookingExpiryQueue,
  paymentQueue,
  customerImportQueue,
  portalUserImportQueue,
  emailQueue,
} from "./queues";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/api/admin/bull-board");

createBullBoard({
  queues: [
    new BullMQAdapter(syncQueue),
    new BullMQAdapter(importQueue),
    new BullMQAdapter(customerImportQueue),
    new BullMQAdapter(portalUserImportQueue),
    new BullMQAdapter(notificationQueue),
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(paymentQueue),
    new BullMQAdapter(bookingExpiryQueue),
    new BullMQAdapter(cleanupQueue),
    new BullMQAdapter(analyticsQueue),
  ],
  serverAdapter,
});

export { serverAdapter };
