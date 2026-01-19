import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";

// Force dynamic rendering for auth check
export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await getB2BSession();

  // If not logged in, redirect to login
  if (!session.isLoggedIn) {
    redirect("/login");
  }

  // If logged in with tenant, redirect to tenant's B2B dashboard
  if (session.tenantId) {
    redirect(`/${session.tenantId}/b2b`);
  }

  // Fallback to login if no tenant (shouldn't happen)
  redirect("/login");
}
