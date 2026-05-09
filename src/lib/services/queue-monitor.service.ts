import type { Job, Queue } from "bullmq";
import {
  syncQueue,
  importQueue,
  customerImportQueue,
  portalUserImportQueue,
  notificationQueue,
  emailQueue,
  paymentQueue,
  bookingExpiryQueue,
  cleanupQueue,
  analyticsQueue,
} from "@/lib/queue/queues";

export const TENANT_VISIBLE_QUEUES = [
  { id: "sync-queue", label: "Marketplace Sync", queue: syncQueue },
  { id: "import-queue", label: "PIM Import", queue: importQueue },
  { id: "customer-import-queue", label: "Customer Import", queue: customerImportQueue },
  { id: "portal-user-import-queue", label: "Portal User Import", queue: portalUserImportQueue },
  { id: "notification-queue", label: "Notifications", queue: notificationQueue },
  { id: "email", label: "Email", queue: emailQueue },
  { id: "payment-queue", label: "Payments", queue: paymentQueue },
  { id: "booking-expiry-queue", label: "Booking Expiry", queue: bookingExpiryQueue },
  { id: "cleanup-queue", label: "Cleanup", queue: cleanupQueue },
  { id: "analytics-queue", label: "Analytics", queue: analyticsQueue },
] as const;

export type JobState = "waiting" | "active" | "completed" | "failed" | "delayed";

export const JOB_STATES: JobState[] = ["waiting", "active", "completed", "failed", "delayed"];

const SCAN_CAP_PER_STATE = 1000;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export function getQueueById(id: string): Queue | null {
  const found = TENANT_VISIBLE_QUEUES.find((q) => q.id === id);
  return found?.queue ?? null;
}

function jobMatchesTenant(job: Job, tenantId: string): boolean {
  const data = job.data as Record<string, unknown> | undefined;
  if (!data) return false;
  const t = (data as any).tenant_id ?? (data as any).tenantId ?? (data as any).tenant;
  return typeof t === "string" && t === tenantId;
}

/** Effective timestamp used for time-based filtering — finished > processed > created. */
export function jobEffectiveTimestamp(job: Job): number {
  return job.finishedOn || job.processedOn || job.timestamp || 0;
}

function jobMatchesTimeRange(
  job: Job,
  fromMs: number | null,
  toMs: number | null
): boolean {
  if (fromMs === null && toMs === null) return true;
  const t = jobEffectiveTimestamp(job);
  if (fromMs !== null && t < fromMs) return false;
  if (toMs !== null && t > toMs) return false;
  return true;
}

export interface StateCount {
  count: number;
  capped: boolean;
}

export async function countTenantJobsByState(
  queue: Queue,
  tenantId: string
): Promise<Record<JobState, StateCount>> {
  const result = {} as Record<JobState, StateCount>;

  for (const state of JOB_STATES) {
    const jobs = await queue.getJobs([state], 0, SCAN_CAP_PER_STATE - 1, false);
    const count = jobs.filter((j) => jobMatchesTenant(j, tenantId)).length;
    result[state] = { count, capped: jobs.length >= SCAN_CAP_PER_STATE };
  }

  return result;
}

export interface JobSummary {
  id: string;
  name: string;
  state: JobState;
  attempts: number;
  progress: number | object;
  data: unknown;
  returnvalue: unknown;
  failedReason?: string;
  stacktrace?: string[];
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

async function jobToSummary(job: Job, state: JobState): Promise<JobSummary> {
  return {
    id: String(job.id),
    name: job.name,
    state,
    attempts: job.attemptsMade,
    progress: job.progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

export interface PaginatedJobs {
  jobs: JobSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  scanned: number;
  scanCap: number;
  capped: boolean;
}

export async function paginateTenantJobs(
  queue: Queue,
  tenantId: string,
  state: JobState,
  page: number,
  pageSize: number,
  fromMs: number | null = null,
  toMs: number | null = null
): Promise<PaginatedJobs> {
  const fetched = await queue.getJobs([state], 0, SCAN_CAP_PER_STATE - 1, false);
  const tenantJobs = fetched.filter((j) => jobMatchesTenant(j, tenantId));
  const filtered = tenantJobs.filter((j) => jobMatchesTimeRange(j, fromMs, toMs));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const jobs = await Promise.all(slice.map((j) => jobToSummary(j, state)));

  return {
    jobs,
    page: safePage,
    pageSize,
    total,
    totalPages,
    scanned: fetched.length,
    scanCap: SCAN_CAP_PER_STATE,
    capped: fetched.length >= SCAN_CAP_PER_STATE,
  };
}

export async function getTenantJob(
  queue: Queue,
  tenantId: string,
  jobId: string
): Promise<JobSummary | null> {
  const job = await queue.getJob(jobId);
  if (!job || !jobMatchesTenant(job, tenantId)) return null;
  const state = (await job.getState()) as JobState;
  return jobToSummary(job, state);
}
