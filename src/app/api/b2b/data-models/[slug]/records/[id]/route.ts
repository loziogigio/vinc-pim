/**
 * GET    /api/b2b/data-models/[slug]/records/[id]
 * PATCH  /api/b2b/data-models/[slug]/records/[id]   — partial update of `data`
 * DELETE /api/b2b/data-models/[slug]/records/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { loadDefinition } from "@/lib/data-models/load-definition";
import {
  extractExternalRef,
  validateRecordData,
  ValidationError,
} from "@/lib/data-models/validate-record";

type RouteParams = { params: Promise<{ slug: string; id: string }> };

function isObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, id } = await params;
    if (!isObjectId(id)) {
      return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
    }

    const loaded = await loadDefinition(auth.tenantDb, slug, { requireEnabled: false });
    if (!loaded.ok) return loaded.response;

    const doc = await loaded.loaded.RecordModel.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("[GET .../records/:id]", error);
    const message = error instanceof Error ? error.message : "Failed to read record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, id } = await params;
    if (!isObjectId(id)) {
      return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
    }

    const loaded = await loadDefinition(auth.tenantDb, slug);
    if (!loaded.ok) return loaded.response;
    const { definition, RecordModel } = loaded.loaded;

    const existing = await RecordModel.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const body = await req.json();
    if (!body?.data || typeof body.data !== "object") {
      return NextResponse.json({ error: "data is required" }, { status: 400 });
    }

    // Validate the submitted partial data as a full object — caller is
    // expected to send the full new shape. (We don't deep-merge silently.)
    let coerced: Record<string, unknown>;
    try {
      coerced = validateRecordData(body.data, definition.fields, {
        strict: true,
        partial: true,
      });
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json({ error: e.message, path: e.path }, { status: 400 });
      }
      throw e;
    }

    // Merge into existing data (shallow at top level — nested objects are replaced as whole values)
    const merged: Record<string, unknown> = { ...(existing.data ?? {}), ...coerced };
    existing.data = merged;
    existing.markModified("data");

    if (definition.external_ref_field) {
      const newRef = extractExternalRef(merged, definition.external_ref_field);
      if (newRef !== undefined) {
        existing.external_ref = newRef;
      }
    }

    if (typeof body.source === "string") existing.source = body.source;

    await existing.save();
    return NextResponse.json({ success: true, data: existing.toObject() });
  } catch (error) {
    console.error("[PATCH .../records/:id]", error);
    const message = error instanceof Error ? error.message : "Failed to update record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug, id } = await params;
    if (!isObjectId(id)) {
      return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
    }

    const loaded = await loadDefinition(auth.tenantDb, slug, { requireEnabled: false });
    if (!loaded.ok) return loaded.response;

    const result = await loaded.loaded.RecordModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("[DELETE .../records/:id]", error);
    const message = error instanceof Error ? error.message : "Failed to delete record";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
