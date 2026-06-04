import { redirect } from "next/navigation";
import { getDashboardAuthorization } from "@/lib/auth/dashboard-authorization";
import { UsersManager } from "@/components/b2b/team/users-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const authz = await getDashboardAuthorization();
  if (!new Set(authz.permissions).has("users.manage")) redirect("/b2b/admin");
  return <UsersManager />;
}
