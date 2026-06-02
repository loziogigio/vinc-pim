import { redirect } from "next/navigation";
import { getDashboardAuthorization } from "@/lib/auth/dashboard-authorization";

export const dynamic = "force-dynamic";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const authz = await getDashboardAuthorization();
  const can = new Set(authz.permissions);
  if (!can.has("roles.manage") && !can.has("users.manage")) redirect("/b2b");
  return <>{children}</>;
}
