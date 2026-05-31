import { NextResponse } from "next/server";
import type { AuthSuccess } from "@/lib/auth/tenant-auth";
import type { PermissionKey } from "@/lib/auth/permissions/catalog";

/**
 * Permission gate for B2B API routes. Returns a ready-to-return 403 NextResponse
 * when the authenticated caller lacks `permission`, or null when allowed.
 *
 *   const auth = await requireTenantAuth(req);
 *   if (!auth.success) return auth.response;
 *   const denied = requirePermission(auth, "roles.manage");
 *   if (denied) return denied;
 */
export function requirePermission(auth: AuthSuccess, permission: PermissionKey): NextResponse | null {
  if (auth.can(permission)) return null;
  return NextResponse.json({ error: `Forbidden: missing permission '${permission}'` }, { status: 403 });
}

/** Allow if the caller holds ANY of the listed permissions (else 403). */
export function requireAnyPermission(auth: AuthSuccess, permissions: PermissionKey[]): NextResponse | null {
  if (permissions.some((p) => auth.can(p))) return null;
  return NextResponse.json({ error: `Forbidden: requires one of ${permissions.join(", ")}` }, { status: 403 });
}
