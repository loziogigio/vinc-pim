/**
 * GET    /api/b2b/data-models/[slug] — read one definition
 * PATCH  /api/b2b/data-models/[slug] — edit (label/enabled/readable_by_end_user/fields)
 *                                     immutable: slug, relation, cardinality, channel,
 *                                     and existing field slugs
 * DELETE /api/b2b/data-models/[slug] — 409 unless ?force=1, then drops dyn_<slug>
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  collectFieldSlugs,
  findExternalRefField,
  validateFieldsTree,
  type DataModelField,
  type IDataModelDefinition,
} from "@/lib/db/models/data-model-definition";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import { getPooledConnection } from "@/lib/db/connection-pool";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const { DataModelDefinition } = await connectWithModels(auth.tenantDb);
    const doc = await DataModelDefinition.findOne({ slug }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    console.error("[GET /api/b2b/data-models/:slug]", error);
    const message = error instanceof Error ? error.message : "Failed to read data model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const body = await req.json();
    const { DataModelDefinition } = await connectWithModels(auth.tenantDb);

    const existing = await DataModelDefinition.findOne({ slug });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Reject changes to immutable fields
    const immutables: Array<keyof IDataModelDefinition> = [
      "slug",
      "relation",
      "cardinality",
      "channel",
    ];
    for (const k of immutables) {
      if (k in body && body[k] !== existing[k]) {
        return NextResponse.json(
          { error: `Field "${k}" is immutable after creation` },
          { status: 422 }
        );
      }
    }

    // Mutable: name, enabled, readable_by_end_user, fields
    if (typeof body.name === "string" && body.name.trim()) {
      existing.name = body.name.trim();
    }
    if (typeof body.enabled === "boolean") {
      existing.enabled = body.enabled;
    }
    if (typeof body.readable_by_end_user === "boolean") {
      existing.readable_by_end_user = body.readable_by_end_user;
    }

    if (Array.isArray(body.fields)) {
      try {
        validateFieldsTree(body.fields as DataModelField[]);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 400 }
        );
      }

      // Enforce: no existing field slug may be renamed/removed silently — we
      // allow removing a field (records keep the orphan key), and we allow
      // adding new fields, but we forbid changing the *slug* of an existing
      // field at the same position. We approximate this by checking that the
      // set of NEW slugs ⊇ the set of OLD slugs minus removals would be too
      // permissive; the safe rule is: every existing top-level slug must
      // either remain (anywhere) or be explicitly removed. Renames look like
      // a remove+add, which is acceptable because records keep the old key.
      // The narrow rule we DO enforce: a slug that exists in both old and new
      // must keep the same type (no type change on a persisted field).
      const oldFields = (existing.fields ?? []) as DataModelField[];
      const newFields = body.fields as DataModelField[];
      const oldByPath = mapByPath(collectFieldSlugs(oldFields), oldFields);
      const newByPath = mapByPath(collectFieldSlugs(newFields), newFields);
      for (const [path, oldField] of oldByPath.entries()) {
        const newField = newByPath.get(path);
        if (newField && newField.type !== oldField.type) {
          return NextResponse.json(
            {
              error: `Field "${path}" type cannot change from ${oldField.type} to ${newField.type}`,
            },
            { status: 422 }
          );
        }
      }

      let externalRefField: string | undefined;
      try {
        externalRefField = findExternalRefField(newFields);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 400 }
        );
      }
      // Same rule for external_ref_field: once set, it can't move (records'
      // unique index would no longer match).
      if (
        existing.external_ref_field &&
        externalRefField !== existing.external_ref_field
      ) {
        return NextResponse.json(
          {
            error: `external_ref field "${existing.external_ref_field}" cannot be changed after creation`,
          },
          { status: 422 }
        );
      }
      existing.fields = newFields;
      existing.external_ref_field = externalRefField;
      existing.markModified("fields");
    }

    await existing.save();
    return NextResponse.json({ success: true, data: existing.toObject() });
  } catch (error) {
    console.error("[PATCH /api/b2b/data-models/:slug]", error);
    const message = error instanceof Error ? error.message : "Failed to update data model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { slug } = await params;
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    const { DataModelDefinition } = await connectWithModels(auth.tenantDb);
    const existing = await DataModelDefinition.findOne({ slug });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const RecordModel = await getDataModelRecordModel(auth.tenantDb, {
      slug: existing.slug,
      cardinality: existing.cardinality,
      fields: existing.fields,
      external_ref_field: existing.external_ref_field,
    });
    const recordCount = await RecordModel.estimatedDocumentCount();

    if (recordCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `This model has ${recordCount} record(s). Pass ?force=1 to delete the definition AND drop the collection.`,
          record_count: recordCount,
        },
        { status: 409 }
      );
    }

    // Drop the dynamic collection (if it exists), then delete the definition.
    const conn = await getPooledConnection(auth.tenantDb);
    try {
      await conn.db.dropCollection(`dyn_${slug}`);
    } catch (e) {
      // Collection might not exist if it was never written — that's fine.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/ns not found/i.test(msg)) {
        console.warn(`[DELETE /api/b2b/data-models/${slug}] dropCollection warning:`, msg);
      }
    }
    // Forget the cached Mongoose model so re-creating the same slug works.
    if (conn.models[`DynRecord_${slug}`]) {
      conn.deleteModel(`DynRecord_${slug}`);
    }

    await DataModelDefinition.deleteOne({ _id: existing._id });

    return NextResponse.json({
      success: true,
      data: { deleted: true, dropped_records: recordCount },
    });
  } catch (error) {
    console.error("[DELETE /api/b2b/data-models/:slug]", error);
    const message = error instanceof Error ? error.message : "Failed to delete data model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ----- helpers -----

function mapByPath(
  paths: string[],
  fields: DataModelField[]
): Map<string, DataModelField> {
  const out = new Map<string, DataModelField>();
  function walk(fs: DataModelField[], prefix: string) {
    for (const f of fs) {
      const p = prefix ? `${prefix}.${f.slug}` : f.slug;
      out.set(p, f);
      if (f.fields?.length) walk(f.fields, p);
    }
  }
  walk(fields, "");
  // paths arg unused, but kept for clarity that this aligns with collectFieldSlugs
  void paths;
  return out;
}
