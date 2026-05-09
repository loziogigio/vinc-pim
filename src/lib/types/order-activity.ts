/**
 * Order Activity Timeline — shared types
 *
 * The activity modal on the order detail page consumes these shapes.
 * Events are assembled server-side from the order document, related
 * Mongo collections, and live Windmill job fetches.
 */

export type ActivitySeverity = "info" | "success" | "warning" | "error";

export type ActivitySource =
  | "order"
  | "windmill"
  | "erp"
  | "payment"
  | "document"
  | "booking"
  | "form"
  | "quotation"
  | "discount"
  | "item";

export type ActivitySectionName =
  | "lifecycle"
  | "jobs"
  | "erp"
  | "payments"
  | "quotations"
  | "discounts"
  | "items"
  | "documents"
  | "bookings"
  | "forms"
  | "processingErrors";

export const ACTIVITY_SECTION_NAMES: ActivitySectionName[] = [
  "lifecycle",
  "jobs",
  "erp",
  "payments",
  "quotations",
  "discounts",
  "items",
  "documents",
  "bookings",
  "forms",
  "processingErrors",
];

export type BadgeTone =
  | "default"
  | "sync"
  | "async"
  | "success"
  | "failure"
  | "warning"
  | "info";

export interface ActivityBadge {
  label: string;
  tone?: BadgeTone;
}

export interface TimelineEvent {
  /** Stable, unique within the order — safe for React keys. */
  id: string;
  /** ISO-8601 timestamp. Used for sorting and display. */
  at: string;
  source: ActivitySource;
  /** Event sub-type within the source, e.g. "status_change", "job_run", "erp_call". */
  type: string;
  /** Short title resolved server-side (already translated). */
  title: string;
  /** Optional one-line subtitle (also already translated). */
  subtitle?: string;
  severity: ActivitySeverity;
  /** User id or "system" — rendered as a badge on the card. */
  actor?: string;
  /**
   * Identifier surfaced as a copyable pill on the card header (e.g. the
   * Windmill job_id). Always visible without expanding the card.
   */
  copyId?: string;
  /** Extra badges rendered next to the title (e.g. "sync", "async", "completed"). */
  badges?: ActivityBadge[];
  /** Structured input payload — rendered as the "Request" JSON panel. */
  request?: unknown;
  /** Structured output payload — rendered as the "Response" JSON panel. */
  response?: unknown;
  /** Optional script/stdout text — rendered as a plain "Logs" panel. */
  logs?: string;
  /** Browser-reachable deep link (e.g. the Windmill job or script page). */
  externalUrl?: string;
  /** Label for the external link (e.g. "Open in Windmill"). */
  externalUrlLabel?: string;
  /** Full underlying record (Mongo doc, Windmill job, etc.) for "raw" toggle. */
  raw?: unknown;
}

export interface ActivitySectionPage {
  events: TimelineEvent[];
  nextCursor: string | null;
  totalCount: number;
}

export type ActivitySectionsMap = Record<ActivitySectionName, ActivitySectionPage>;

export interface OrderActivityResponse {
  sections: ActivitySectionsMap;
}

export interface OrderActivitySectionResponse {
  section: ActivitySectionName;
  page: ActivitySectionPage;
}
