/**
 * Generic filter parser for /records list endpoints.
 *
 * Reads URL params shaped like:
 *   ?filter[<field_slug>]=value          → equality
 *   ?filter[<slug>][gte]=…&[lte]=…       → range
 *   ?filter[<slug>][in]=a,b,c            → IN
 *
 * Only fields marked `filterable: true` on the definition are accepted;
 * any other key is silently ignored (defensive — never leak random query
 * params into a Mongo filter).
 *
 * Pagination + sort are also parsed here for consistency across routes.
 */

import type { DataModelField } from "@/lib/db/models/data-model-definition";

export interface ListQuery {
  page: number;
  limit: number;
  skip: number;
  /** Top-level Mongo filter; merge into other constraints (relation_id, channel, …) */
  filter: Record<string, unknown>;
  sortBy: string;
  sortDir: 1 | -1;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export function parseListQuery(
  url: URL,
  fields: DataModelField[]
): ListQuery {
  const sp = url.searchParams;

  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(sp.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const filter: Record<string, unknown> = {};

  // Allowed filter keys: top-level fields marked filterable, plus any nested
  // (`<parent>.<child>`) field whose chain has filterable=true on the leaf.
  // For now we only expose top-level filterables (nested filtering is a future
  // iteration — the index strategy in model-registry only indexes top-level).
  const allowedTopLevel = new Map<string, DataModelField>();
  for (const f of fields) {
    if (f.filterable) allowedTopLevel.set(f.slug, f);
  }

  for (const [rawKey, rawValue] of sp.entries()) {
    const match = rawKey.match(/^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/);
    if (!match) continue;

    const [, fieldSlug, op] = match;
    const field = allowedTopLevel.get(fieldSlug);
    if (!field) continue;

    const mongoPath = `data.${fieldSlug}`;
    const coerced = coerceForField(rawValue, field);

    if (!op) {
      filter[mongoPath] = coerced;
      continue;
    }
    if (op === "in") {
      const list = String(rawValue)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => coerceForField(v, field));
      filter[mongoPath] = { $in: list };
      continue;
    }
    if (op === "gte" || op === "lte" || op === "gt" || op === "lt") {
      const existing = (filter[mongoPath] as Record<string, unknown> | undefined) ?? {};
      filter[mongoPath] = { ...existing, [`$${op}`]: coerced };
      continue;
    }
    if (op === "ne") {
      filter[mongoPath] = { $ne: coerced };
      continue;
    }
    // Unknown op → ignore
  }

  // Sort: ?sort=field,-otherfield. Defaults to imported_at desc, then _id desc.
  let sortBy = "imported_at";
  let sortDir: 1 | -1 = -1;
  const sortParam = sp.get("sort");
  if (sortParam) {
    const first = sortParam.split(",")[0].trim();
    if (first.startsWith("-")) {
      sortBy = first.slice(1);
      sortDir = -1;
    } else {
      sortBy = first;
      sortDir = 1;
    }
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    filter,
    sortBy,
    sortDir,
  };
}

function coerceForField(raw: string, field: DataModelField): unknown {
  switch (field.type) {
    case "number": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case "checkbox":
      return raw === "true" || raw === "1";
    case "date": {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d.toISOString();
    }
    default:
      return raw;
  }
}
