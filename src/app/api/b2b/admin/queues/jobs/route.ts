import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import {
  getQueueById,
  paginateTenantJobs,
  getTenantJob,
  JOB_STATES,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  type JobState,
} from "@/lib/services/queue-monitor.service";

// GET /api/b2b/admin/queues/jobs?queue=<id>&state=<state>&page=<n>&pageSize=<n>
// GET /api/b2b/admin/queues/jobs?queue=<id>&jobId=<id>
export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;
  const { tenantId } = auth;

  const url = new URL(req.url);
  const queueId = url.searchParams.get("queue");
  if (!queueId) {
    return NextResponse.json({ error: "queue parameter is required" }, { status: 400 });
  }

  const queue = getQueueById(queueId);
  if (!queue) {
    return NextResponse.json({ error: "Queue not found" }, { status: 404 });
  }

  const jobId = url.searchParams.get("jobId");
  if (jobId) {
    const job = await getTenantJob(queue, tenantId, jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
  }

  const stateParam = url.searchParams.get("state") || "waiting";
  if (!JOB_STATES.includes(stateParam as JobState)) {
    return NextResponse.json(
      { error: `Invalid state. Must be one of: ${JOB_STATES.join(", ")}` },
      { status: 400 }
    );
  }

  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const requestedPageSize = Number(url.searchParams.get("pageSize") || DEFAULT_PAGE_SIZE);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const fromMs = parseTimeParam(fromParam);
  const toMs = parseTimeParam(toParam);
  if (fromParam && fromMs === null) {
    return NextResponse.json({ error: "Invalid 'from' timestamp" }, { status: 400 });
  }
  if (toParam && toMs === null) {
    return NextResponse.json({ error: "Invalid 'to' timestamp" }, { status: 400 });
  }

  const result = await paginateTenantJobs(
    queue,
    tenantId,
    stateParam as JobState,
    page,
    pageSize,
    fromMs,
    toMs
  );

  return NextResponse.json({
    queue: queueId,
    state: stateParam,
    filter: { from: fromMs, to: toMs },
    ...result,
  });
}

function parseTimeParam(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isNaN(n) && n > 0) return n;
  const d = new Date(v).getTime();
  return Number.isNaN(d) ? null : d;
}
