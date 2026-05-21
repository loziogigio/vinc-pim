/**
 * GET /api/b2b/me/data/[slug]/records/[id]
 *
 * Returns the record only if it belongs to the authenticated user. 404 in
 * every other case (including "exists but not yours" — don't leak the id).
 */

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { loadDefinition } from "@/lib/data-models/load-definition";

type RouteParams = { params: Promise<{ slug: string; id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req, { requireUserId: true });
    if (!auth.success) return auth.response;

    const { slug, id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
    }

    const loaded = await loadDefinition(auth.tenantDb, slug);
    if (!loaded.ok) return loaded.response;
    const { definition, RecordModel } = loaded.loaded;

    if (!definition.readable_by_end_user) {
      return NextResponse.json(
        { error: "This data model is not readable by end users" },
        { status: 403 }
      );
    }
    if (!relationTypeMatches(definition.relation, auth.userType)) {
      return NextResponse.json(
        {
          error: `This data model is keyed by ${definition.relation}, but you are signed in as ${auth.userType ?? "unknown"}`,
        },
        { status: 403 }
      );
    }

    const doc = await RecordModel.findOne({
      _id: id,
      relation_id: auth.userId,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("[GET /api/b2b/me/data/:slug/records/:id]", error);
    const message = error instanceof Error ? error.message : "Failed to read record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function relationTypeMatches(
  relation: "portal_user" | "customer",
  userType: string | undefined
): boolean {
  if (relation === "customer") return userType === "b2b_user";
  return userType === "portal_user";
}
