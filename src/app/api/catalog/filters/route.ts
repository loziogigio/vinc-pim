/**
 * Catalog proxy — Filter options
 *
 * GET /api/catalog/filters → OC /api/v1/catalog/filters
 *
 * Public endpoint (no auth). Returns distinct filter values for UI dropdowns.
 */

import { NextResponse } from "next/server";
import { ocFetch, OCClientError } from "@/lib/services/oc-client";

export async function GET() {
  try {
    const data = await ocFetch("/catalog/filters");
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
