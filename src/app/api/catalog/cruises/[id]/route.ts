/**
 * Catalog proxy — Single cruise detail
 *
 * GET /api/catalog/cruises/:id → OC /api/v1/catalog/cruises/:id
 *
 * Public endpoint (no auth). Enriches OC data with PIM ship/cabin data.
 */

import { NextRequest, NextResponse } from "next/server";
import { ocFetch, OCClientError } from "@/lib/services/oc-client";
import { enrichCruiseDetail } from "@/lib/services/cruise-enrichment.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const data = await ocFetch<{ data: any }>(`/catalog/cruises/${encodeURIComponent(id)}`);

    // Enrich with PIM data (ship gallery, descriptions, YouTube, cabin images)
    if (data?.data) {
      try {
        data.data = await enrichCruiseDetail(data.data);
      } catch (enrichErr) {
        console.error("[catalog/cruises/id] enrichment failed:", enrichErr);
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof OCClientError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
