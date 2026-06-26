import { ERP_SETTINGS_BLUEPRINT } from "./erp-settings";
import { COUPON_SETTINGS_BLUEPRINT } from "./coupon-settings";
import { PIPELINE_SETTINGS_BLUEPRINT } from "./pipeline-settings";
import { CART_SETTINGS_BLUEPRINT } from "./cart-settings";
import { CATALOG_SETTINGS_BLUEPRINT } from "./catalog-settings";
import type { DataModelBlueprint } from "./types";

export type { DataModelBlueprint } from "./types";

/** Installable blueprints, keyed by id. Add new blueprints here. */
export const BLUEPRINTS: Record<string, DataModelBlueprint> = {
  [ERP_SETTINGS_BLUEPRINT.id]: ERP_SETTINGS_BLUEPRINT,
  [COUPON_SETTINGS_BLUEPRINT.id]: COUPON_SETTINGS_BLUEPRINT,
  [PIPELINE_SETTINGS_BLUEPRINT.id]: PIPELINE_SETTINGS_BLUEPRINT,
  [CART_SETTINGS_BLUEPRINT.id]: CART_SETTINGS_BLUEPRINT,
  [CATALOG_SETTINGS_BLUEPRINT.id]: CATALOG_SETTINGS_BLUEPRINT,
};

export function getBlueprint(id: string): DataModelBlueprint | undefined {
  return BLUEPRINTS[id];
}
