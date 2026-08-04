/**
 * Publish-status resolution for API imports.
 *
 * Who owns `status` on an imported product: the auto-publish gate, or the caller?
 * The caller — when it says so. Auto-publish is a *default* for payloads that stay
 * silent about status, never an override of a stated intent. Without this, a source
 * with `auto_publish_enabled` could publish but could never unpublish: an archive
 * payload (`status: "draft"`, `not_visible: true`, `quantity: 0`, no channels) had
 * every field applied except the one that mattered.
 */

/** The values `IPIMProduct.status` accepts — keep in sync with the PIM schema. */
export const PIM_PRODUCT_STATUSES = ["draft", "published", "archived"] as const;

export type PIMProductStatus = (typeof PIM_PRODUCT_STATUSES)[number];

export interface ResolveImportStatusInput {
  /** `status` as stated in the merged import payload (arbitrary JSON — may be anything). */
  requestedStatus?: unknown;
  /** Result of the auto-publish gate for this product. */
  autoPublishEligible: boolean;
  /** Human-readable gate outcome, recorded on the product. */
  autoPublishReason: string;
}

export interface ResolvedImportStatus {
  status: PIMProductStatus;
  /** Convenience mirror of `status === "published"` for `isCurrentPublished`/`published_at`. */
  isPublished: boolean;
  /** The payload stated a valid status and it decided the outcome. */
  explicit: boolean;
  /** Auto-publish decided to publish (payload stated nothing). */
  autoPublished: boolean;
  /** Set when the payload stated a status that isn't a valid value — ignored, worth logging. */
  ignoredStatus?: string;
  /** Why this status was chosen, stored as `auto_publish_reason`. */
  reason: string;
}

function toValidStatus(value: unknown): PIMProductStatus | undefined {
  return typeof value === "string" && (PIM_PRODUCT_STATUSES as readonly string[]).includes(value)
    ? (value as PIMProductStatus)
    : undefined;
}

/**
 * Decide the status to write: an explicit, valid status in the payload wins;
 * otherwise the auto-publish gate decides.
 */
export function resolveImportStatus({
  requestedStatus,
  autoPublishEligible,
  autoPublishReason,
}: ResolveImportStatusInput): ResolvedImportStatus {
  const explicitStatus = toValidStatus(requestedStatus);

  if (explicitStatus) {
    return {
      status: explicitStatus,
      isPublished: explicitStatus === "published",
      explicit: true,
      autoPublished: false,
      reason: `Explicit status "${explicitStatus}" from import payload (auto-publish: ${autoPublishReason})`,
    };
  }

  const status: PIMProductStatus = autoPublishEligible ? "published" : "draft";

  return {
    status,
    isPublished: autoPublishEligible,
    explicit: false,
    autoPublished: autoPublishEligible,
    // Only report a stated-but-unusable value; absent/null status is the normal case.
    ...(typeof requestedStatus === "string" ? { ignoredStatus: requestedStatus } : {}),
    reason: autoPublishReason,
  };
}

/**
 * Does this import have to write even though the content hash is unchanged?
 *
 * Content hashing deliberately ignores `status` (see CONTENT_HASH_EXCLUDE), so a
 * status-only payload used to be dropped as "unchanged" — which deadlocked any
 * product whose earlier archive attempt had already applied the other fields.
 *
 * Only an *explicit* status forces the write. Auto-publish must never force one:
 * a re-sync of unchanged content would otherwise re-publish every manually
 * archived or unpublished product.
 */
export function requiresStatusWrite(
  resolved: ResolvedImportStatus,
  storedStatus: string | undefined
): boolean {
  return resolved.explicit && storedStatus !== resolved.status;
}
