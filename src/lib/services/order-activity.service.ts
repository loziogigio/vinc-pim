/**
 * Order Activity Service — assembles a chronological timeline of
 * everything time-stamped that touched a given order.
 *
 * Data sources:
 *   - order document itself (lifecycle timestamps, items, quotation,
 *     discounts, payment, erp_data.windmill_jobs)
 *   - related Mongo collections (paymenttransactions, documents,
 *     bookings, formsubmissions)
 *   - live Windmill API for each job_id captured during submission
 *
 * The service is stateless — the API route is responsible for auth
 * and for calling `assembleOrderActivity` or `loadSection`.
 */

import type { Model } from "mongoose";
import { connectWithModels } from "@/lib/db/connection";
import type { IOrder } from "@/lib/db/models/order";
import type {
  ActivityBadge,
  ActivitySectionName,
  ActivitySectionPage,
  ActivitySectionsMap,
  ActivitySeverity,
  TimelineEvent,
} from "@/lib/types/order-activity";
import { ACTIVITY_SECTION_NAMES } from "@/lib/types/order-activity";
import { fetchWindmillJobs, type WindmillJobDetails } from "./windmill-job-fetch.service";
import { getProxySettings } from "./windmill-proxy.service";

// ─── SECTION DEFAULTS ────────────────────────────────────────────

const DEFAULT_SECTION_LIMIT = 20;
const SINGLE_SECTION_LIMIT = 50;

// ─── HELPERS ─────────────────────────────────────────────────────

function toIso(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

interface WindmillLinkCtx {
  baseUrl: string;
  workspace: string | null;
}

async function resolveWindmillLinkCtx(
  tenantDb: string,
): Promise<WindmillLinkCtx | null> {
  try {
    const settings = await getProxySettings(tenantDb);
    const baseUrl = (
      process.env.WINDMILL_EXTERNAL_URL ||
      settings?.windmill_external_url ||
      process.env.WINDMILL_BASE_URL ||
      settings?.windmill_base_url ||
      ""
    ).replace(/\/+$/, "");
    if (!baseUrl) return null;
    const workspace =
      settings?.workspace_name || process.env.WINDMILL_WORKSPACE || null;
    return { baseUrl, workspace };
  } catch {
    return null;
  }
}

function windmillJobUrl(ctx: WindmillLinkCtx, jobId: string): string {
  const wsSuffix = ctx.workspace ? `?workspace=${encodeURIComponent(ctx.workspace)}` : "";
  return `${ctx.baseUrl}/run/${encodeURIComponent(jobId)}${wsSuffix}`;
}

function windmillScriptRunsUrl(
  ctx: WindmillLinkCtx,
  scriptPath: string,
): string {
  const wsSuffix = ctx.workspace ? `?workspace=${encodeURIComponent(ctx.workspace)}` : "";
  return `${ctx.baseUrl}/runs/${encodeURIComponent(scriptPath)}${wsSuffix}`;
}

function paginate(
  events: TimelineEvent[],
  cursor: string | null,
  limit: number,
): ActivitySectionPage {
  const sorted = events
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const filtered = cursor ? sorted.filter((e) => e.at < cursor) : sorted;
  const page = filtered.slice(0, limit);
  const nextCursor =
    filtered.length > limit ? page[page.length - 1]?.at ?? null : null;
  return {
    events: page,
    nextCursor,
    totalCount: sorted.length,
  };
}

// ─── SECTION BUILDERS ────────────────────────────────────────────

function buildLifecycle(order: IOrder): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const push = (
    at: string | null,
    type: string,
    title: string,
    severity: ActivitySeverity,
    extra?: Partial<TimelineEvent>,
  ) => {
    if (!at) return;
    events.push({
      id: `lifecycle:${type}:${at}`,
      at,
      source: "order",
      type,
      title,
      severity,
      ...extra,
    });
  };

  push(toIso(order.created_at), "created", "Order created", "info", {
    subtitle: `status=draft`,
    actor: "system",
    raw: { created_at: order.created_at, initial_status: "draft" },
  });
  push(toIso(order.submitted_at), "submitted", "Order submitted", "info", {
    actor: order.cancelled_by || "system",
    subtitle: order.shipping_method ? `shipping=${order.shipping_method}` : undefined,
    raw: {
      submitted_at: order.submitted_at,
      shipping_method: order.shipping_method,
      requested_delivery_date: order.requested_delivery_date,
      notes: order.notes,
    },
  });
  push(toIso(order.confirmed_at), "confirmed", "Order confirmed", "success", {
    raw: {
      confirmed_at: order.confirmed_at,
      order_number: order.order_number,
      year: order.year,
    },
  });
  push(toIso(order.preparing_at), "preparing", "Order preparing", "info");
  push(toIso(order.shipped_at), "shipped", "Order shipped", "info", {
    raw: order.delivery ?? null,
  });
  push(toIso(order.delivered_at), "delivered", "Order delivered", "success");
  push(toIso(order.cancelled_at), "cancelled", "Order cancelled", "warning", {
    actor: order.cancelled_by,
    subtitle: order.cancellation_reason,
    raw: {
      cancelled_at: order.cancelled_at,
      cancelled_by: order.cancelled_by,
      reason: order.cancellation_reason,
    },
  });
  push(toIso(order.duplicated_at), "duplicated", "Order duplicated", "info", {
    subtitle: order.duplicated_from
      ? `from=${order.duplicated_from}`
      : undefined,
    raw: {
      duplicated_from: order.duplicated_from,
      duplications: order.duplications,
    },
  });
  return events;
}

/** Extract the last path segment of a Windmill script path (e.g.
 *  "f/vinc_dfl_it/b2b/before_order_submit" → "before_order_submit"). */
function scriptBaseName(scriptPath?: string): string | undefined {
  if (!scriptPath) return undefined;
  const parts = scriptPath.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

function buildJobs(
  order: IOrder,
  details: Map<string, WindmillJobDetails>,
  linkCtx: WindmillLinkCtx | null,
): TimelineEvent[] {
  const erpData = (order.erp_data || {}) as Record<string, unknown>;
  const jobs = Array.isArray(erpData.windmill_jobs)
    ? (erpData.windmill_jobs as Array<Record<string, unknown>>)
    : [];

  return jobs.map((job, idx) => {
    const jobId = String(job.job_id || "");
    const isAsync = job.mode === "async";
    const isSyntheticId = jobId.startsWith("sync-");
    // Any non-synthetic id can be looked up in Windmill — sync calls
    // tracked via `windmillRunTracked` now carry real job ids too.
    const live = !isSyntheticId && jobId ? details.get(jobId) : undefined;
    const at =
      toIso((live?.started_at as string | undefined) ?? undefined) ||
      toIso((job.started_at as string | undefined) ?? undefined) ||
      toIso((job.timestamp as string | undefined) ?? undefined) ||
      toIso((job.completed_at as string | undefined) ?? undefined) ||
      new Date(0).toISOString();
    const rawStatus =
      (live?.status as string | undefined) ??
      (job.status as string | undefined) ??
      "unknown";
    // Normalise both Windmill ("success"/"failure") and our ref schema
    // ("completed"/"failed") into a single label.
    const normalisedStatus =
      rawStatus === "success" || rawStatus === "completed"
        ? "completed"
        : rawStatus === "failure" || rawStatus === "failed"
          ? "failed"
          : rawStatus;
    const severity: ActivitySeverity =
      normalisedStatus === "failed"
        ? "error"
        : normalisedStatus === "completed"
          ? "success"
          : normalisedStatus === "running" || normalisedStatus === "queued"
            ? "warning"
            : "info";
    const script =
      (live?.script_path as string | undefined) ??
      (job.script as string | undefined);
    const scriptName = scriptBaseName(script);
    const phase = (job.phase as string | undefined) ?? "job";
    const operation = job.operation as string | undefined;
    const mode = job.mode as string | undefined;
    const duration =
      (live?.duration_ms as number | undefined) ??
      (job.duration_ms as number | undefined);

    const badges: ActivityBadge[] = [];
    if (mode) {
      badges.push({
        label: mode,
        tone: mode === "sync" ? "sync" : mode === "async" ? "async" : "default",
      });
    }
    badges.push({
      label: normalisedStatus,
      tone:
        normalisedStatus === "completed"
          ? "success"
          : normalisedStatus === "failed"
            ? "failure"
            : normalisedStatus === "running" || normalisedStatus === "queued"
              ? "warning"
              : "info",
    });
    if (duration !== undefined) {
      badges.push({ label: `${duration}ms`, tone: "default" });
    }

    const titleParts: string[] = [phase];
    if (scriptName) titleParts.push(scriptName);
    const title = titleParts.join("/");

    const subtitleParts: string[] = [];
    if (operation) subtitleParts.push(operation);
    if (script && script !== scriptName) subtitleParts.push(script);
    const subtitle = subtitleParts.join(" · ") || undefined;

    // Prefer the inline args/result captured by the proxy service at
    // invocation time (sync calls and async enqueues). Only fall back
    // to live-fetched Windmill data for async jobs whose result lives
    // on the Windmill server.
    const request = job.args !== undefined ? job.args : (live?.args ?? null);
    const response =
      job.result !== undefined
        ? job.result
        : live?.result ??
          (job.error ? { error: job.error } : null);

    // Always surface whatever id we have (real Windmill job_id or the
    // sync synthetic marker) so the row is copyable and correlatable
    // against logs / DB queries. The external link is still gated on
    // whether Windmill can resolve the id.
    const copyId = jobId || undefined;

    // Windmill deep link: whenever we have a real (non-synthetic) job
    // id, point directly at that specific run. Fall back to the script
    // runs-history only for legacy entries that still have a synthetic
    // id and therefore can't be resolved to a single run.
    let externalUrl: string | undefined;
    let externalUrlLabel: string | undefined;
    if (linkCtx) {
      if (jobId && !isSyntheticId) {
        externalUrl = windmillJobUrl(linkCtx, jobId);
        externalUrlLabel = "Open job in Windmill";
      } else if (script) {
        externalUrl = windmillScriptRunsUrl(linkCtx, script);
        externalUrlLabel = "Open script runs in Windmill";
      }
    }

    return {
      id: `job:${jobId || `idx-${idx}`}`,
      at,
      source: "windmill",
      type: "job_run",
      title,
      subtitle,
      severity,
      actor: "windmill",
      copyId,
      badges,
      request,
      response,
      logs: live?.logs,
      externalUrl,
      externalUrlLabel,
      raw: {
        ref: job,
        live,
      },
    };
  });
}

function buildErpCalls(order: IOrder): TimelineEvent[] {
  const erpData = (order.erp_data || {}) as Record<string, unknown>;
  const events: TimelineEvent[] = [];

  const completed = Array.isArray(erpData.completed_steps)
    ? (erpData.completed_steps as Array<Record<string, unknown>>)
    : [];
  completed.forEach((step, i) => {
    const at =
      toIso((step.completed_at as string | undefined) ?? undefined) ||
      toIso((step.timestamp as string | undefined) ?? undefined) ||
      toIso(order.submitted_at) ||
      toIso(order.created_at)!;
    events.push({
      id: `erp:step:${i}:${String(step.name ?? "step")}`,
      at,
      source: "erp",
      type: "erp_step",
      title: String(step.name ?? step.step ?? "ERP step"),
      subtitle: step.duration_ms ? `${step.duration_ms}ms` : undefined,
      severity: step.error ? "error" : "success",
      actor: "erp",
      request: step.input ?? step.request ?? null,
      response: step.output ?? step.response ?? step.result ?? null,
      raw: step,
    });
  });

  const mysqlErrors = Array.isArray(erpData.mysql_errors)
    ? (erpData.mysql_errors as Array<Record<string, unknown>>)
    : [];
  mysqlErrors.forEach((err, i) => {
    const at =
      toIso((err.timestamp as string | undefined) ?? undefined) ||
      toIso(order.submitted_at) ||
      toIso(order.created_at)!;
    events.push({
      id: `erp:mysql-error:${i}`,
      at,
      source: "erp",
      type: "erp_error",
      title: `ERP MySQL error${err.code ? ` ${err.code}` : ""}`,
      subtitle:
        (err.message as string | undefined) ??
        (err.error as string | undefined),
      severity: "error",
      actor: "erp",
      request: err.query ?? err.request ?? null,
      response: err,
      raw: err,
    });
  });

  return events;
}

function buildProcessingErrors(order: IOrder): TimelineEvent[] {
  const errs = order.processing_errors || [];
  const at =
    toIso(order.processing_completed_at) ||
    toIso(order.processing_started_at) ||
    toIso(order.submitted_at) ||
    toIso(order.created_at)!;
  return errs.map((err, i) => {
    const message = typeof err === "string" ? err : err.message;
    const severity: ActivitySeverity =
      typeof err === "object" && err.severity === "warning" ? "warning" : "error";
    return {
      id: `processing-error:${i}`,
      at,
      source: "order",
      type: "processing_error",
      title: message,
      subtitle:
        typeof err === "object"
          ? [err.field, err.line_number ? `line ${err.line_number}` : undefined]
              .filter(Boolean)
              .join(" · ") || undefined
          : undefined,
      severity,
      actor: "system",
      response: err,
      raw: err,
    };
  });
}

function buildQuotations(order: IOrder): TimelineEvent[] {
  const revisions = order.quotation?.revisions || [];
  return revisions.map((rev) => ({
    id: `quotation:rev:${rev.revision_number}`,
    at: toIso(rev.created_at)!,
    source: "quotation",
    type: "quotation_revision",
    title: `Revision ${rev.revision_number} · ${rev.actor_type}`,
    subtitle: rev.notes || undefined,
    severity: "info",
    actor: rev.created_by_name || rev.created_by,
    request: {
      items_added: rev.items_added,
      items_removed: rev.items_removed,
      items_qty_changed: rev.items_qty_changed,
      cart_discounts_added: rev.cart_discounts_added,
      line_adjustments_added: rev.line_adjustments_added,
    },
    response: {
      subtotal_net: rev.subtotal_net,
      total_discount: rev.total_discount,
      order_total: rev.order_total,
    },
    raw: rev,
  }));
}

function buildDiscounts(order: IOrder): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  (order.cart_discounts || []).forEach((d) => {
    events.push({
      id: `discount:cart:${d.discount_id}`,
      at: toIso(d.applied_at)!,
      source: "discount",
      type: "cart_discount_applied",
      title: `Cart discount · ${d.type}${d.type === "percentage" ? ` ${d.value}%` : ` ${d.value}`}`,
      subtitle: d.description || d.reason,
      severity: "info",
      actor: d.applied_by,
      request: { reason: d.reason, type: d.type, value: d.value },
      raw: d,
    });
  });
  (order.line_adjustments || []).forEach((a) => {
    events.push({
      id: `discount:line:${a.adjustment_id}`,
      at: toIso(a.applied_at)!,
      source: "discount",
      type: "line_adjustment_applied",
      title: `Line ${a.line_number} · ${a.type}`,
      subtitle: a.description || a.reason,
      severity: "info",
      actor: a.applied_by,
      request: {
        type: a.type,
        original_value: a.original_value,
        new_value: a.new_value,
      },
      raw: a,
    });
  });
  return events;
}

function buildItems(order: IOrder): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const item of order.items || []) {
    const added = toIso(item.added_at);
    const updated = toIso(item.updated_at);
    if (added) {
      events.push({
        id: `item:added:${item.line_number}`,
        at: added,
        source: "item",
        type: "item_added",
        title: `Line ${item.line_number} added · ${item.sku}`,
        subtitle: `${item.name} · qty=${item.quantity}`,
        severity: "info",
        actor: item.added_from || item.added_via || "system",
        request: { sku: item.sku, quantity: item.quantity, added_from: item.added_from, added_via: item.added_via },
        raw: item,
      });
    }
    if (updated && updated !== added) {
      events.push({
        id: `item:updated:${item.line_number}:${updated}`,
        at: updated,
        source: "item",
        type: "item_updated",
        title: `Line ${item.line_number} updated · ${item.sku}`,
        subtitle: `qty=${item.quantity} · unit=${item.unit_price}`,
        severity: "info",
        actor: "system",
        request: { quantity: item.quantity, unit_price: item.unit_price },
        raw: item,
      });
    }
  }
  return events;
}

// ─── RELATED-COLLECTION BUILDERS ────────────────────────────────

async function buildPayments(
  order: IOrder,
  PaymentTransaction: Model<Record<string, unknown>>,
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const p of order.payment?.payments || []) {
    events.push({
      id: `payment:embedded:${p.payment_id}`,
      at: toIso(p.recorded_at)!,
      source: "payment",
      type: "payment_recorded",
      title: `Payment ${p.amount} ${order.currency ?? ""} · ${p.method}`,
      subtitle: p.reference ? `ref ${p.reference}` : undefined,
      severity: p.confirmed ? "success" : "warning",
      actor: p.recorded_by,
      request: { method: p.method, amount: p.amount, reference: p.reference },
      response: p.provider_data ?? null,
      raw: p,
    });
  }

  try {
    const txs = (await PaymentTransaction.find({ order_id: order.order_id })
      .sort({ created_at: -1 })
      .limit(200)
      .lean()) as Array<Record<string, unknown>>;
    for (const tx of txs) {
      const at =
        toIso((tx.created_at as Date | undefined) ?? undefined) ||
        toIso((tx.updated_at as Date | undefined) ?? undefined)!;
      events.push({
        id: `payment:tx:${String(tx.transaction_id)}`,
        at,
        source: "payment",
        type: "payment_transaction",
        title: `${tx.provider} · ${tx.payment_type} · ${tx.status}`,
        subtitle: `${tx.gross_amount} ${tx.currency}${tx.payment_number ? ` · ${tx.payment_number}` : ""}`,
        severity:
          tx.status === "succeeded" || tx.status === "captured"
            ? "success"
            : tx.status === "failed"
              ? "error"
              : "info",
        actor: (tx.provider as string) ?? undefined,
        request: {
          provider_payment_id: tx.provider_payment_id,
          method: tx.method,
          gross_amount: tx.gross_amount,
          currency: tx.currency,
        },
        response: {
          status: tx.status,
          provider_capture_id: tx.provider_capture_id,
          failure_reason: tx.failure_reason,
          failure_code: tx.failure_code,
          events: tx.events,
        },
        raw: tx,
      });
    }
  } catch (err) {
    console.error("[order-activity] payment tx load failed:", err);
  }

  return events;
}

async function buildDocuments(
  order: IOrder,
  DocumentModel: Model<Record<string, unknown>>,
): Promise<TimelineEvent[]> {
  try {
    const docs = (await DocumentModel.find({ source_order_id: order.order_id })
      .sort({ created_at: -1 })
      .limit(100)
      .lean()) as Array<Record<string, unknown>>;
    return docs.map((d) => ({
      id: `document:${String(d._id)}`,
      at:
        toIso((d.created_at as Date | undefined) ?? undefined) ||
        toIso((d.finalized_at as Date | undefined) ?? undefined) ||
        new Date(0).toISOString(),
      source: "document",
      type: "document_generated",
      title: `${d.document_type}${d.document_number ? ` · ${d.document_number}` : ""}`,
      subtitle:
        (d.status as string | undefined) ??
        (d.finalized_at ? "finalized" : "draft"),
      severity: d.voided_at ? "warning" : "info",
      actor: "system",
      response: {
        status: d.status,
        document_number: d.document_number,
        pdf_url: d.pdf_url,
        sent_to: d.sent_to,
      },
      raw: d,
    }));
  } catch (err) {
    console.error("[order-activity] document load failed:", err);
    return [];
  }
}

async function buildBookings(
  order: IOrder,
  BookingModel: Model<Record<string, unknown>>,
): Promise<TimelineEvent[]> {
  try {
    const bookings = (await BookingModel.find({ order_id: order.order_id })
      .sort({ created_at: -1 })
      .limit(100)
      .lean()) as Array<Record<string, unknown>>;
    return bookings.map((b) => ({
      id: `booking:${String(b.booking_id)}`,
      at:
        toIso((b.created_at as Date | undefined) ?? undefined) ||
        new Date(0).toISOString(),
      source: "booking",
      type: "booking_created",
      title: `Booking · ${b.departure_label}`,
      subtitle: `qty=${b.quantity} · ${b.status}`,
      severity:
        b.status === "confirmed"
          ? "success"
          : b.status === "cancelled"
            ? "warning"
            : "info",
      actor: (b.customer_id as string) ?? undefined,
      response: {
        status: b.status,
        hold_expires_at: b.hold_expires_at,
        confirmed_at: b.confirmed_at,
        cancelled_at: b.cancelled_at,
      },
      raw: b,
    }));
  } catch (err) {
    console.error("[order-activity] booking load failed:", err);
    return [];
  }
}

async function buildForms(
  order: IOrder,
  FormSubmissionModel: Model<Record<string, unknown>>,
): Promise<TimelineEvent[]> {
  try {
    const subs = (await FormSubmissionModel.find({ order_id: order.order_id })
      .sort({ created_at: -1 })
      .limit(100)
      .lean()) as Array<Record<string, unknown>>;
    return subs.map((s) => ({
      id: `form:${String(s._id)}`,
      at:
        toIso((s.created_at as Date | undefined) ?? undefined) ||
        new Date(0).toISOString(),
      source: "form",
      type: "form_submitted",
      title: `Form · ${s.form_type}${s.form_definition_slug ? ` · ${s.form_definition_slug}` : ""}`,
      subtitle: (s.submitter_email as string | undefined) ?? undefined,
      severity: "info",
      actor: (s.submitter_email as string | undefined) ?? "anonymous",
      request: s.data,
      raw: s,
    }));
  } catch (err) {
    console.error("[order-activity] form submission load failed:", err);
    return [];
  }
}

// ─── ORCHESTRATION ───────────────────────────────────────────────

interface AssembleOptions {
  /** Per-section page size when returning all sections. */
  perSectionLimit?: number;
  /** Used when loading a single section. */
  section?: ActivitySectionName;
  /** ISO cursor for single-section pagination. */
  cursor?: string | null;
  /** Limit override for single-section pagination. */
  limit?: number;
}

/**
 * Load everything needed for the activity feed — order doc, related
 * collection events, and live Windmill job details (for the Jobs
 * section). Each section is then paginated and returned.
 */
export async function assembleOrderActivity(
  tenantDb: string,
  orderId: string,
  opts: AssembleOptions = {},
): Promise<{
  order: IOrder;
  sections: ActivitySectionsMap;
} | null> {
  const perSectionLimit = opts.perSectionLimit ?? DEFAULT_SECTION_LIMIT;
  const { Order, PaymentTransaction, Document, Booking, FormSubmission } =
    (await connectWithModels(tenantDb)) as unknown as {
      Order: Model<IOrder>;
      PaymentTransaction: Model<Record<string, unknown>>;
      Document: Model<Record<string, unknown>>;
      Booking: Model<Record<string, unknown>>;
      FormSubmission: Model<Record<string, unknown>>;
    };

  const order = await Order.findOne({ order_id: orderId }).lean<IOrder>();
  if (!order) return null;

  // Live-fetch any entry that has a real (non-synthetic) Windmill id.
  // Since `windmillRunTracked` now returns a real id for sync calls too,
  // both sync and async rows benefit from Windmill's logs/timing.
  const jobIds: string[] = (
    ((order.erp_data as Record<string, unknown> | undefined)
      ?.windmill_jobs as Array<Record<string, unknown>> | undefined) ?? []
  )
    .filter(
      (j) =>
        typeof j.job_id === "string" &&
        j.job_id.length > 0 &&
        !j.job_id.startsWith("sync-"),
    )
    .map((j) => String(j.job_id));

  const [jobDetails, payments, documents, bookings, forms, linkCtx] =
    await Promise.all([
      fetchWindmillJobs(tenantDb, jobIds),
      buildPayments(order, PaymentTransaction),
      buildDocuments(order, Document),
      buildBookings(order, Booking),
      buildForms(order, FormSubmission),
      resolveWindmillLinkCtx(tenantDb),
    ]);

  const eventsBySection: Record<ActivitySectionName, TimelineEvent[]> = {
    lifecycle: buildLifecycle(order),
    jobs: buildJobs(order, jobDetails, linkCtx),
    erp: buildErpCalls(order),
    payments,
    quotations: buildQuotations(order),
    discounts: buildDiscounts(order),
    items: buildItems(order),
    documents,
    bookings,
    forms,
    processingErrors: buildProcessingErrors(order),
  };

  const sections = {} as ActivitySectionsMap;
  for (const name of ACTIVITY_SECTION_NAMES) {
    sections[name] = paginate(eventsBySection[name], null, perSectionLimit);
  }

  return { order, sections };
}

/**
 * Load a single section paginated by cursor — used for "Load more".
 */
export async function loadSection(
  tenantDb: string,
  orderId: string,
  section: ActivitySectionName,
  cursor: string | null,
  limit: number = SINGLE_SECTION_LIMIT,
): Promise<{ order: IOrder; page: ActivitySectionPage } | null> {
  const { Order, PaymentTransaction, Document, Booking, FormSubmission } =
    (await connectWithModels(tenantDb)) as unknown as {
      Order: Model<IOrder>;
      PaymentTransaction: Model<Record<string, unknown>>;
      Document: Model<Record<string, unknown>>;
      Booking: Model<Record<string, unknown>>;
      FormSubmission: Model<Record<string, unknown>>;
    };

  const order = await Order.findOne({ order_id: orderId }).lean<IOrder>();
  if (!order) return null;

  let events: TimelineEvent[] = [];
  switch (section) {
    case "lifecycle":
      events = buildLifecycle(order);
      break;
    case "jobs": {
      const jobIds: string[] = (
        ((order.erp_data as Record<string, unknown> | undefined)
          ?.windmill_jobs as Array<Record<string, unknown>> | undefined) ?? []
      )
        .filter(
          (j) =>
            typeof j.job_id === "string" &&
            j.job_id.length > 0 &&
            !j.job_id.startsWith("sync-"),
        )
        .map((j) => String(j.job_id));
      const [details, linkCtx] = await Promise.all([
        fetchWindmillJobs(tenantDb, jobIds),
        resolveWindmillLinkCtx(tenantDb),
      ]);
      events = buildJobs(order, details, linkCtx);
      break;
    }
    case "erp":
      events = buildErpCalls(order);
      break;
    case "payments":
      events = await buildPayments(order, PaymentTransaction);
      break;
    case "quotations":
      events = buildQuotations(order);
      break;
    case "discounts":
      events = buildDiscounts(order);
      break;
    case "items":
      events = buildItems(order);
      break;
    case "documents":
      events = await buildDocuments(order, Document);
      break;
    case "bookings":
      events = await buildBookings(order, Booking);
      break;
    case "forms":
      events = await buildForms(order, FormSubmission);
      break;
    case "processingErrors":
      events = buildProcessingErrors(order);
      break;
  }

  return { order, page: paginate(events, cursor, limit) };
}
