import { ERP_SETTINGS_BLUEPRINT } from "./erp-settings";
import type { DataModelBlueprint } from "./types";

export type { DataModelBlueprint } from "./types";

/** Installable blueprints, keyed by id. Add new blueprints here. */
export const BLUEPRINTS: Record<string, DataModelBlueprint> = {
  [ERP_SETTINGS_BLUEPRINT.id]: ERP_SETTINGS_BLUEPRINT,
};

export function getBlueprint(id: string): DataModelBlueprint | undefined {
  return BLUEPRINTS[id];
}
