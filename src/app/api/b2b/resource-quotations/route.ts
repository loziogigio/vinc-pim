import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection-pool";
import {
  createResourceQuotation,
  type CreateResourceQuotationInput,
} from "@/lib/services/resource-quotation.service";

export async function POST(req: NextRequest) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  let body: CreateResourceQuotationInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body?.customer?.email) {
    return NextResponse.json(
      { error: "customer.email is required" },
      { status: 400 }
    );
  }
  if (!body?.customer?.name) {
    return NextResponse.json(
      { error: "customer.name is required" },
      { status: 400 }
    );
  }
  if (!body?.lines || body.lines.length === 0) {
    return NextResponse.json(
      { error: "lines array must not be empty" },
      { status: 400 }
    );
  }

  const tenantDbConn = await getPooledConnection(auth.tenantDb);
  const result = await createResourceQuotation(
    tenantDbConn,
    auth.tenantId!,
    body
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to create quotation" },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({ success: true, quotation: result.data }, { status: 201 });
}
