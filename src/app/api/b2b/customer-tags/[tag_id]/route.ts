/**
 * Single Customer Tag API
 *
 * GET /api/b2b/customer-tags/[tag_id] - Fetch one tag definition by id
 *
 * Lets the tag detail page load just the tag it needs instead of fetching the
 * whole collection and finding it client-side.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getTagAuth } from "../_auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag_id: string }> },
) {
  const auth = await getTagAuth();
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tag_id } = await params;
  const { CustomerTag } = await connectWithModels(auth.tenantDb);
  const tag = await CustomerTag.findOne({ tag_id }).lean();

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, tag });
}
