/**
 * Unit Tests for Order Activity — Jobs section event id uniqueness.
 *
 * `erp_data.windmill_jobs` is an append-only log (see `pushWindmillJobRef`
 * in windmill-proxy.service), so the same Windmill `job_id` can appear in
 * more than one entry (e.g. enqueue + later re-track). Each entry becomes a
 * timeline event, and `TimelineEvent.id` is documented as "unique within the
 * order — safe for React keys". Duplicate job_ids must therefore still yield
 * unique event ids, or the activity feed renders siblings with the same React
 * key and warns ("Encountered two children with the same key, `job:...`").
 */

import { describe, it, expect } from "vitest";
import { buildJobs } from "@/lib/services/order-activity.service";
import type { IOrder } from "@/lib/db/models/order";

function orderWithJobs(jobs: Array<Record<string, unknown>>): IOrder {
  return {
    order_id: "ord-test",
    erp_data: { windmill_jobs: jobs },
  } as unknown as IOrder;
}

describe("unit: order-activity buildJobs — event id uniqueness", () => {
  it("produces unique ids when windmill_jobs has duplicate job_id entries", () => {
    const dupId = "019e83a9-3763-d3b5-6fac-2882f52bfdf5";
    const order = orderWithJobs([
      {
        job_id: dupId,
        phase: "on",
        operation: "submit",
        mode: "async",
        status: "queued",
        started_at: "2026-05-01T10:00:00.000Z",
      },
      {
        job_id: dupId,
        phase: "after",
        operation: "submit",
        mode: "async",
        status: "completed",
        started_at: "2026-05-01T10:00:05.000Z",
      },
    ]);

    const events = buildJobs(order, new Map(), null);

    expect(events).toHaveLength(2);
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps ids unique even when job_id is missing on multiple entries", () => {
    const order = orderWithJobs([
      { phase: "before", operation: "submit", mode: "sync", started_at: "2026-05-01T10:00:00.000Z" },
      { phase: "after", operation: "submit", mode: "sync", started_at: "2026-05-01T10:00:01.000Z" },
    ]);

    const events = buildJobs(order, new Map(), null);
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("still surfaces the raw Windmill job_id via copyId for correlation", () => {
    const jobId = "abc-123";
    const order = orderWithJobs([
      {
        job_id: jobId,
        phase: "on",
        operation: "submit",
        mode: "async",
        started_at: "2026-05-01T10:00:00.000Z",
      },
    ]);

    const [event] = buildJobs(order, new Map(), null);
    expect(event.copyId).toBe(jobId);
  });
});
