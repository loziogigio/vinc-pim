import { safeRegexQuery } from "@/lib/security";
import type { CsvColumn } from "@/lib/utils/csv";

/**
 * Shared query construction for form submissions, used by the b2c and b2b list
 * routes and by both export routes.
 *
 * Before this existed the two list routes were byte-identical apart from the model
 * and the scope key, and email/seen/date filtering happened client-side over the 25
 * already-fetched rows — which made "export everything matching the filters"
 * impossible to honour on the server.
 */

export type SubmissionScopeField = "storefront_slug" | "portal_slug";
export type SubmissionFormType = "page_form" | "standalone";

export interface SubmissionFilters {
  /** substring, case-insensitive */
  page_slug?: string;
  form_type?: SubmissionFormType;
  /** substring, case-insensitive */
  ip?: string;
  /** substring, case-insensitive, matched against submitter_email */
  email?: string;
  seen?: boolean;
  /** YYYY-MM-DD */
  date_from?: string;
  /** YYYY-MM-DD */
  date_to?: string;
}

const FORM_TYPES: readonly string[] = ["page_form", "standalone"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readRaw(
  source: URLSearchParams | Record<string, unknown>,
  key: string
): unknown {
  return source instanceof URLSearchParams ? source.get(key) : source[key];
}

function readTrimmed(
  source: URLSearchParams | Record<string, unknown>,
  key: string
): string | undefined {
  const raw = readRaw(source, key);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Valid only if it is a real calendar date — rejects dates with day overflow (e.g., Feb 30, Apr 31, non-leap-year Feb 29). */
function readIsoDate(
  source: URLSearchParams | Record<string, unknown>,
  key: string
): string | undefined {
  const value = readTrimmed(source, key);
  if (!value || !ISO_DATE.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  // Round-trip: convert back to YYYY-MM-DD and verify it matches the input
  const roundTrip = parsed.toISOString().slice(0, 10);
  return roundTrip === value ? value : undefined;
}

function readSeen(
  source: URLSearchParams | Record<string, unknown>
): boolean | undefined {
  const raw = readRaw(source, "seen");
  if (typeof raw === "boolean") return raw;
  if (raw === "seen") return true;
  if (raw === "unseen") return false;
  return undefined;
}

/** Accepts either a URLSearchParams (list routes) or a plain object (POST body). */
export function parseSubmissionFilters(
  source: URLSearchParams | Record<string, unknown>
): SubmissionFilters {
  const filters: SubmissionFilters = {};

  const pageSlug = readTrimmed(source, "page_slug");
  if (pageSlug) filters.page_slug = pageSlug;

  const formType = readTrimmed(source, "form_type");
  if (formType && FORM_TYPES.includes(formType)) {
    filters.form_type = formType as SubmissionFormType;
  }

  const ip = readTrimmed(source, "ip");
  if (ip) filters.ip = ip;

  const email = readTrimmed(source, "email");
  if (email) filters.email = email;

  const seen = readSeen(source);
  if (seen !== undefined) filters.seen = seen;

  const dateFrom = readIsoDate(source, "date_from");
  if (dateFrom) filters.date_from = dateFrom;

  const dateTo = readIsoDate(source, "date_to");
  if (dateTo) filters.date_to = dateTo;

  return filters;
}

/**
 * Builds the Mongo filter. The scope key is applied unconditionally and first, so
 * no combination of caller-supplied filters can widen a query beyond one
 * storefront or portal.
 *
 * Dates are interpreted as UTC day boundaries so the table and the export always
 * agree, regardless of the operator's timezone.
 */
export function buildSubmissionQuery(
  scopeField: SubmissionScopeField,
  slug: string,
  filters: SubmissionFilters
): Record<string, unknown> {
  const query: Record<string, unknown> = { [scopeField]: slug };

  if (filters.page_slug) query.page_slug = safeRegexQuery(filters.page_slug);
  if (filters.form_type) query.form_type = filters.form_type;
  if (filters.ip) query.ip_address = safeRegexQuery(filters.ip);
  if (filters.email) query.submitter_email = safeRegexQuery(filters.email);
  if (filters.seen !== undefined) query.seen = filters.seen;

  if (filters.date_from || filters.date_to) {
    const createdAt: Record<string, Date> = {};
    if (filters.date_from) {
      createdAt.$gte = new Date(`${filters.date_from}T00:00:00.000Z`);
    }
    if (filters.date_to) {
      createdAt.$lte = new Date(`${filters.date_to}T23:59:59.999Z`);
    }
    query.created_at = createdAt;
  }

  return query;
}

/** Column-key prefix for dynamic answer fields, keeping them from colliding with
 *  the fixed meta keys (a form field literally named "seen" is legal). */
const DATA_PREFIX = "data.";

/** Fixed meta columns, in emitted order. */
const META_COLUMN_KEYS = [
  "submitted_at",
  "form",
  "form_type",
  "page_slug",
  "submitter_email",
  "ip_address",
  "seen",
] as const;

export interface SubmissionCsvLabels {
  submitted_at: string;
  form: string;
  form_type: string;
  page_slug: string;
  submitter_email: string;
  ip_address: string;
  seen: string;
  yes: string;
  no: string;
  page_form: string;
  standalone: string;
}

/** Minimal shape the exporter needs from a lean submission document. */
export interface ExportSubmission {
  page_slug?: string;
  form_type?: string;
  form_definition_slug?: string;
  data?: Record<string, unknown>;
  submitter_email?: string;
  ip_address?: string;
  seen?: boolean;
  created_at?: Date | string;
}

/** Minimal shape the exporter needs from a lean form-definition document. */
export interface ExportDefinition {
  slug: string;
  config?: { fields?: Array<{ id: string; label?: string }> };
}

function humanise(key: string): string {
  return key.replace(/_/g, " ");
}

/**
 * Builds the column list: seven fixed meta columns, then one column per distinct
 * `data` key present in the exported set.
 *
 * Data columns are ordered by walking the form definitions (sorted by slug) in
 * their declared field order, which keeps related answers adjacent; any key with
 * no matching field is appended alphabetically. Only keys some submission
 * actually used are emitted, so an unused optional field never becomes an empty
 * column. The result is deterministic — two exports of the same rows produce
 * byte-identical files.
 */
export function buildSubmissionCsvColumns(
  submissions: ExportSubmission[],
  definitions: ExportDefinition[],
  labels: SubmissionCsvLabels
): CsvColumn[] {
  const columns: CsvColumn[] = META_COLUMN_KEYS.map((key) => ({
    key,
    header: labels[key],
  }));

  const usedKeys = new Set<string>();
  for (const submission of submissions) {
    for (const key of Object.keys(submission.data ?? {})) usedKeys.add(key);
  }

  const seen = new Set<string>();
  const sortedDefinitions = [...definitions].sort((a, b) => a.slug.localeCompare(b.slug));

  for (const definition of sortedDefinitions) {
    for (const field of definition.config?.fields ?? []) {
      if (!usedKeys.has(field.id) || seen.has(field.id)) continue;
      seen.add(field.id);
      columns.push({
        key: `${DATA_PREFIX}${field.id}`,
        header: field.label || humanise(field.id),
      });
    }
  }

  const leftovers = [...usedKeys].filter((key) => !seen.has(key)).sort();
  for (const key of leftovers) {
    columns.push({ key: `${DATA_PREFIX}${key}`, header: humanise(key) });
  }

  return columns;
}

function toIsoString(value: Date | string | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

/** Mirrors the inbox's getSourceLabel: standalone submissions are identified by
 *  their definition slug, page forms by the page they sit on. */
function sourceLabel(submission: ExportSubmission): string {
  if (submission.form_type === "standalone" && submission.form_definition_slug) {
    return submission.form_definition_slug;
  }
  return submission.page_slug ?? "";
}

export function toSubmissionCsvRow(
  submission: ExportSubmission,
  columns: CsvColumn[],
  labels: SubmissionCsvLabels
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    submitted_at: toIsoString(submission.created_at),
    form: sourceLabel(submission),
    form_type:
      submission.form_type === "standalone" ? labels.standalone : labels.page_form,
    page_slug: submission.page_slug ?? "",
    submitter_email: submission.submitter_email ?? "",
    ip_address: submission.ip_address ?? "",
    seen: submission.seen ? labels.yes : labels.no,
  };

  const data = submission.data ?? {};
  for (const column of columns) {
    if (!column.key.startsWith(DATA_PREFIX)) continue;
    const fieldId = column.key.slice(DATA_PREFIX.length);
    if (fieldId in data) row[column.key] = data[fieldId];
  }

  return row;
}
