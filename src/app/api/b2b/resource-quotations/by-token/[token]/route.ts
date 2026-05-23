import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { getPooledConnection } from "@/lib/db/connection-pool";
import { getResourceQuotationByToken } from "@/lib/services/resource-quotation.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireTenantAuth(req);
  if (!auth.success) return auth.response;

  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const tenantDbConn = await getPooledConnection(auth.tenantDb);
  const result = await getResourceQuotationByToken(tenantDbConn, token);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Not found" },
      { status: result.status || 404 }
    );
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}
