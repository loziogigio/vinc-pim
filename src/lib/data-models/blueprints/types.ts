import type { IDataModelDefinition } from "@/lib/db/models/data-model-definition";

/**
 * A reusable data-model "blueprint": a complete definition (minus the
 * install-time `channel`) plus an optional default record to seed on install.
 * Consumed by both the install API route and the CLI seed scripts.
 */
export interface DataModelBlueprint {
  /** install key — equals the definition slug, e.g. "erp_settings" */
  id: string;
  definition: Omit<
    IDataModelDefinition,
    "_id" | "channel" | "external_ref_field" | "created_at" | "updated_at"
  >;
  /** seeded on install; relation_id is fixed per blueprint (e.g. "_global") */
  defaultRecord?: { relationId: string; data: Record<string, unknown> };
}
