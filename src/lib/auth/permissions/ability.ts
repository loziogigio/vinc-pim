import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import { PERMISSIONS, type AppAction, type AppSubject, type PermissionKey } from "./catalog";
import type { SubjectConditions } from "./scope";

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

/**
 * Compile a set of permission keys (+ optional per-subject scope conditions)
 * into a CASL MongoAbility. Conditions are attached only to the subjects that
 * have them; all other grants are unconditional.
 */
export function buildAbility(
  permissions: PermissionKey[],
  scopeConditions: SubjectConditions
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const key of permissions) {
    const def = PERMISSIONS[key];
    const conditions = scopeConditions[def.subject];
    if (conditions) {
      can(def.action, def.subject, conditions);
    } else {
      can(def.action, def.subject);
    }
  }

  return build();
}
