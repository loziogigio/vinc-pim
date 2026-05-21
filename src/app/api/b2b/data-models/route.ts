/**
 * GET  /api/b2b/data-models           — list definitions in this tenant
 * POST /api/b2b/data-models           — create a definition
 *
 * Auth: requireTenantAuth (cookie / Bearer / API-key).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  RESERVED_SLUGS,
  SLUG_REGEX,
  findExternalRefField,
  validateFieldsTree,
  type DataModelField,
} from "@/lib/db/models/data-model-definition";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import { slugify } from "@/lib/data-models/slugify";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { DataModelDefinition } = await connectWithModels(auth.tenantDb);

    const url = new URL(req.url);
    const enabled = url.searchParams.get("enabled");
    const relation = url.searchParams.get("relation");
    const channel = url.searchParams.get("channel");

    const filter: Record<string, unknown> = {};
    if (enabled === "true") filter.enabled = true;
    if (enabled === "false") filter.enabled = false;
    if (relation) filter.relation = relation;
    if (channel) filter.channel = channel;

    const items = await DataModelDefinition.find(filter)
      .sort({ created_at: -1 })
      .lean();

    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    console.error("[GET /api/b2b/data-models]", error);
    const message = error instanceof Error ? error.message : "Failed to list data models";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const {
      name,
      slug: rawSlug,
      relation,
      cardinality,
      channel,
      fields = [],
      readable_by_end_user = true,
      enabled = true,
    } = body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (relation !== "portal_user" && relation !== "customer") {
      return NextResponse.json(
        { error: "relation must be 'portal_user' or 'customer'" },
        { status: 400 }
      );
    }
    if (cardinality !== "single" && cardinality !== "multiple") {
      return NextResponse.json(
        { error: "cardinality must be 'single' or 'multiple'" },
        { status: 400 }
      );
    }
    if (!channel || typeof channel !== "string") {
      return NextResponse.json(
        { error: "channel is required (use \"*\" for any)" },
        { status: 400 }
      );
    }

    const slug = (typeof rawSlug === "string" && rawSlug.trim()) || slugify(name);
    if (!SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: `Invalid slug "${slug}". Must match ${SLUG_REGEX.source}` },
        { status: 400 }
      );
    }
    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json(
        { error: `Slug "${slug}" is reserved` },
        { status: 400 }
      );
    }

    try {
      validateFieldsTree(fields as DataModelField[]);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 }
      );
    }

    let externalRefField: string | undefined;
    try {
      externalRefField = findExternalRefField(fields as DataModelField[]);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 }
      );
    }

    const { DataModelDefinition } = await connectWithModels(auth.tenantDb);

    const existing = await DataModelDefinition.findOne({ slug }).lean();
    if (existing) {
      return NextResponse.json(
        { error: `A data model with slug "${slug}" already exists` },
        { status: 409 }
      );
    }

    const doc = await DataModelDefinition.create({
      name: name.trim(),
      slug,
      relation,
      cardinality,
      channel: channel.trim(),
      fields,
      external_ref_field: externalRefField,
      readable_by_end_user: !!readable_by_end_user,
      enabled: !!enabled,
    });

    // Materialize the dynamic collection immediately so its indexes exist on
    // first record write (Mongoose lazily creates collections, but we want the
    // indexes to be ready ahead of any batch import).
    const RecordModel = await getDataModelRecordModel(auth.tenantDb, {
      slug: doc.slug,
      cardinality: doc.cardinality,
      fields: doc.fields,
      external_ref_field: doc.external_ref_field,
    });
    await RecordModel.init();

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/b2b/data-models]", error);
    const message = error instanceof Error ? error.message : "Failed to create data model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

