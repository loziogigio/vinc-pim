import type { AppSubject } from "./catalog";

export type ScopeDimension = "channels" | "customers" | "price_lists";

/** Per-role declaration: which dimensions constrain this role. */
export type RoleScope = Record<ScopeDimension, "all" | "per_user">;

/** Per-user values for the dimensions a role marks "per_user". */
export type ScopeValues = Record<ScopeDimension, "all" | string[]>;

/** Unconstrained scope (full access on every dimension). */
export const ALL_SCOPE: ScopeValues = {
  channels: "all",
  customers: "all",
  price_lists: "all",
};

/**
 * Which subject field each scope dimension constrains. Phase 0A wires the
 * worked example (channels -> Order.channel); Phase 3 extends this table and
 * the query sites that consume the conditions.
 */
const SCOPE_SUBJECT_FIELD: Partial<
  Record<ScopeDimension, { subject: AppSubject; field: string }>
> = {
  channels: { subject: "Order", field: "channel" },
};

export type SubjectConditions = Partial<Record<AppSubject, Record<string, unknown>>>;

/**
 * Build the CASL condition map for a user, given their role's scope declaration
 * and their per-user values. A dimension only constrains when the role marks it
 * "per_user" AND the user has explicit array values (not "all").
 */
export function scopeConditionsFor(
  roleScope: RoleScope,
  values: ScopeValues
): SubjectConditions {
  const conditions: SubjectConditions = {};

  for (const dim of Object.keys(SCOPE_SUBJECT_FIELD) as ScopeDimension[]) {
    if (roleScope[dim] !== "per_user") continue;
    const value = values[dim];
    if (value === "all" || !Array.isArray(value) || value.length === 0) continue;

    const mapping = SCOPE_SUBJECT_FIELD[dim]!;
    conditions[mapping.subject] = {
      ...(conditions[mapping.subject] ?? {}),
      [mapping.field]: { $in: value },
    };
  }

  return conditions;
}
