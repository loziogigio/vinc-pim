/**
 * Catalog proxy — List cruises
 *
 * GET /api/catalog/cruises → OC /api/v1/catalog/cruises
 *
 * Public endpoint (no auth). Forwards query params to OC aggregator.
 * Enriches each cruise with lightweight PIM ship data (cover image, rating).
 */

import { NextRequest, NextResponse } from "next/server";
import { ocFetch, OCClientError } from "@/lib/services/oc-client";
import { enrichCruiseList } from "@/lib/services/cruise-enrichment.service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const params: Record<string, string | undefined> = {
    company: searchParams.get("company") || undefined,
    destination: searchParams.get("destination") || undefined,
    date_from: searchParams.get("date_from") || undefined,
    date_to: searchParams.get("date_to") || undefined,
    duration_min: searchParams.get("duration_min") || undefined,
    duration_max: searchParams.get("duration_max") || undefined,
    price_min: searchParams.get("price_min") || undefined,
    price_max: searchParams.get("price_max") || undefined,
    sort_by: searchParams.get("sort_by") || undefined,
    sort_order: searchParams.get("sort_order") || undefined,
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
  };

  try {
    const data = await ocFetch<{ data: any[] }>("/catalog/cruises", params);

    // Enrich list with lightweight PIM data (ship images, star rating)
    if (data?.data) {
      try {
        data.data = await enrichCruiseList(data.data);
      } catch (enrichErr) {
        console.error("[catalog/cruises] enrichment failed:", enrichErr);
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
