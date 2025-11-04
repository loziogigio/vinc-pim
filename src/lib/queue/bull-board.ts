/**
 * Bull Board Configuration
 * Web UI for monitoring BullMQ queues
 */

import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { importQueue, analyticsQueue } from "./queues";

// Create Express adapter for Bull Board UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/api/admin/bull-board");

// Create Bull Board with all queues
createBullBoard({
  queues: [
    new BullMQAdapter(importQueue),
    new BullMQAdapter(analyticsQueue),
  ],
  serverAdapter,
});

export { serverAdapter };
