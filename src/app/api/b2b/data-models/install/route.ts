/**
 * POST /api/b2b/data-models/install — install a predefined data-model blueprint.
 *
 * Body: { blueprint: string; channel?: string }
 * Creates the definition, materializes dyn_<slug>, and (if the blueprint has a
 * defaultRecord) seeds it. One-time bootstrap: 409 if the slug already exists.
 *
 * Auth: requireTenantAuth (cookie / Bearer / API-key) — same as the rest of
 * /api/b2b/data-models.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  findExternalRefField,
  validateFieldsTree,
} from "@/lib/db/models/data-model-definition";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import { getBlueprint } from "@/lib/data-models/blueprints";
import { validateRecordData, ValidationError } from "@/lib/data-models/validate-record";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const body = await req.json();
    const blueprint = getBlueprint(String(body?.blueprint ?? ""));
    if (!blueprint) {
      return NextResponse.json(
        { error: `Unknown blueprint "${body?.blueprint}"` },
        { status: 400 }
      );
    }

    const channel =
      (typeof body?.channel === "string" && body.channel.trim()) || "default";

    const def = blueprint.definition;

    // Defensive: blueprint is static, but keep parity with the normal create path.
    try {
      validateFieldsTree(def.fields);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      );
    }
    const externalRefField = findExternalRefField(def.fields);

    const { DataModelDefinition } = await connectWithModels(auth.tenantDb);

    const existing = await DataModelDefinition.findOne({ slug: def.slug }).lean();
    if (existing) {
      return NextResponse.json(
        {
          error: `A data model with slug "${def.slug}" already exists`,
          alreadyInstalled: true,
        },
        { status: 409 }
      );
    }

    const doc = await DataModelDefinition.create({
      ...def,
      channel,
      external_ref_field: externalRefField,
    });

    // Materialize the dynamic collection + indexes before any record write.
    const RecordModel = await getDataModelRecordModel(auth.tenantDb, {
      slug: doc.slug,
      cardinality: doc.cardinality,
      fields: doc.fields,
      external_ref_field: doc.external_ref_field,
    });
    await RecordModel.init();

    let recordSeeded = false;
    if (blueprint.defaultRecord) {
      let coerced: Record<string, unknown>;
      try {
        coerced = validateRecordData(blueprint.defaultRecord.data, def.fields, {
          strict: true,
        });
      } catch (e) {
        if (e instanceof ValidationError) {
          return NextResponse.json({ error: e.message, path: e.path }, { status: 400 });
        }
        throw e;
      }

      await RecordModel.findOneAndUpdate(
        { relation_id: blueprint.defaultRecord.relationId, channel },
        {
          $set: {
            relation_id: blueprint.defaultRecord.relationId,
            channel,
            data: coerced,
            source: "install",
            imported_at: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      recordSeeded = true;
    }

    return NextResponse.json(
      { success: true, data: { definition: doc, recordSeeded } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/b2b/data-models/install]", error);
    const message =
      error instanceof Error ? error.message : "Failed to install data model";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
