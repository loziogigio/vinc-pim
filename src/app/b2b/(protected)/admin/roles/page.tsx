import { redirect } from "next/navigation";
import { getDashboardAuthorization } from "@/lib/auth/dashboard-authorization";
import { RolesManager } from "@/components/b2b/team/roles-manager";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const authz = await getDashboardAuthorization();
  if (!new Set(authz.permissions).has("roles.manage")) redirect("/b2b/admin");
  return <RolesManager />;
}
