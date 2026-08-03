import { safeRegexQuery } from "@/lib/security";

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

/** Valid only if it is a real calendar date — "2026-13-45" parses to Invalid Date. */
function readIsoDate(
  source: URLSearchParams | Record<string, unknown>,
  key: string
): string | undefined {
  const value = readTrimmed(source, key);
  if (!value || !ISO_DATE.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
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
