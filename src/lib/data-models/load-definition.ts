/**
 * Shared helper for record routes: given a tenant DB + a slug, load the
 * DataModelDefinition and the dynamic Mongoose record model. Returns a
 * NextResponse 404/410 when the definition is missing or disabled.
 */

import { NextResponse } from "next/server";
import { connectWithModels } from "@/lib/db/connection";
import { getDataModelRecordModel } from "@/lib/db/model-registry";
import type {
  IDataModelDefinition,
  DataModelField,
} from "@/lib/db/models/data-model-definition";
import type { Model } from "mongoose";

interface LoadedDefinition {
  definition: IDataModelDefinition & { fields: DataModelField[] };
  RecordModel: Model<any>;
}

export async function loadDefinition(
  tenantDb: string,
  slug: string,
  options: { requireEnabled?: boolean } = {}
): Promise<{ ok: true; loaded: LoadedDefinition } | { ok: false; response: NextResponse }> {
  const { DataModelDefinition } = await connectWithModels(tenantDb);
  const def = (await DataModelDefinition.findOne({ slug }).lean()) as
    | (IDataModelDefinition & { fields: DataModelField[] })
    | null;

  if (!def) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Data model not found" }, { status: 404 }),
    };
  }
  if (options.requireEnabled !== false && def.enabled === false) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Data model is disabled" }, { status: 410 }),
    };
  }

  const RecordModel = await getDataModelRecordModel(tenantDb, {
    slug: def.slug,
    cardinality: def.cardinality,
    fields: def.fields,
    external_ref_field: def.external_ref_field,
  });

  return { ok: true, loaded: { definition: def, RecordModel } };
}
