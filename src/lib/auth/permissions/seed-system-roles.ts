/**
 * Idempotent system-role seeding. The four presets are upserted into a tenant's
 * `roles` collection under STABLE role_ids so B2BUser.role_id references survive
 * re-seeding. Re-running restores any deleted/edited system role to preset state.
 */
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLE_PRESETS, type SystemRoleKey } from "./system-roles";
import { PRESET_PRICE_ACCESS } from "./price-access";

/** Stable, human-readable ids so references don't break across re-seeds. */
export const SYSTEM_ROLE_IDS: Record<SystemRoleKey, string> = {
  admin: "role_sys_admin",
  helpdesk: "role_sys_helpdesk",
  agent: "role_sys_agent",
  viewer: "role_sys_viewer",
};

export async function ensureSystemRoles(tenantDb: string): Promise<void> {
  const { connectWithModels } = await import("@/lib/db/connection");
  const { Role } = await connectWithModels(tenantDb);

  for (const key of SYSTEM_ROLE_KEYS) {
    const preset = SYSTEM_ROLE_PRESETS[key];
    await Role.updateOne(
      { role_id: SYSTEM_ROLE_IDS[key] },
      {
        $set: {
          name: preset.name,
          description: preset.description,
          is_system: true,
          is_active: true,
          permissions: preset.permissions,
          scope: preset.scope,
          price_access: PRESET_PRICE_ACCESS[key],
        },
        $setOnInsert: { role_id: SYSTEM_ROLE_IDS[key] },
      },
      { upsert: true },
    );
  }
}
