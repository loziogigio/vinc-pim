import type { DiscoveredFacetField } from "@/lib/search/facet-discovery";

export interface FacetFieldsResult {
  fields: DiscoveredFacetField[];
  degraded: boolean;
}

/**
 * Client-side fetch for the facet-fields discovery endpoint.
 *
 * The `/api/search/*` routes are gated by the proxy: a browser (session) call
 * is only admitted when the tenant is provided via the URL path or the
 * `X-Tenant-ID` header (see src/proxy.ts). Admin client components call the
 * bare `/api/search/...` path (no tenant prefix), so we MUST send the tenant
 * as a header or the proxy returns 401 before the route runs. Mirrors the
 * pattern in ProductSearchPreview.tsx.
 *
 * Throws on a non-2xx response so the caller can surface a load error.
 */
export async function fetchFacetFields(
  tenantId: string,
): Promise<FacetFieldsResult> {
  const headers: Record<string, string> = {};
  if (tenantId) headers["X-Tenant-ID"] = tenantId;

  const res = await fetch("/api/search/facet-fields", {
    cache: "no-store",
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    throw new Error(`facet-fields request failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    fields: Array.isArray(data.fields) ? data.fields : [],
    degraded: Boolean(data.degraded),
  };
}
