/**
 * Customer Search API for Documents
 *
 * GET /api/b2b/documents/customers/search?q=
 * Search by company name or VAT number.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDocumentRequest } from "../../_auth";
import { connectWithModels } from "@/lib/db/connection";
import { safeRegexQuery } from "@/lib/security";

export async function GET(req: NextRequest) {
  const auth = await authenticateDocumentRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }

  const { Customer } = await connectWithModels(auth.tenantDb!);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  if (!q || q.length < 2) {
    return NextResponse.json({ success: true, customers: [] });
  }

  const safeQ = safeRegexQuery(q);
  const customers = await Customer.find({
    $or: [
      { company_name: safeQ },
      { "legal_info.vat_number": safeQ },
      { first_name: safeQ },
      { last_name: safeQ },
      { email: safeQ },
    ],
  })
    .select("customer_id company_name first_name last_name email phone customer_type legal_info addresses")
    .limit(limit)
    .lean();

  return NextResponse.json({ success: true, customers });
}
