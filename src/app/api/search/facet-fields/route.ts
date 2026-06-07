/**
 * GET /api/search/facet-fields
 * Returns the merged list of discoverable facet fields for the tenant's Solr collection.
 * Fetches live field data from the Solr Luke handler and merges with the static facet config.
 * Degrades gracefully to static-only when Solr is unreachable.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { fetchSolrLukeFields } from "@/lib/search/solr-client";
import { buildDiscoveredFacetFields } from "@/lib/search/facet-discovery";

export async function GET(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { tenantId } = auth;

  let lukeFields: Record<string, unknown> = {};
  let degraded = false;

  try {
    lukeFields = await fetchSolrLukeFields(tenantId);
  } catch (err) {
    console.error("[GET /api/search/facet-fields] Luke fetch failed", err);
    degraded = true;
  }

  const fields = buildDiscoveredFacetFields(lukeFields);

  return NextResponse.json({ success: true, fields, degraded });
}
