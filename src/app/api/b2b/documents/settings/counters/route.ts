/**
 * Document Counters API
 *
 * GET /api/b2b/documents/settings/counters - Get all counter values
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { getCounterValues } from "@/lib/services/document-numbering.service";

export async function GET(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const counters = await getCounterValues(auth.tenantDb!, year);

  return NextResponse.json({ success: true, counters, year });
}
