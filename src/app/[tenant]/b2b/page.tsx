import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { TenantAppLauncher } from "@/components/b2b/TenantAppLauncher";

// Force dynamic rendering - uses cookies() for session
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ tenant: string }>;
};

export default async function TenantB2BPage({ params }: PageProps) {
  const { tenant } = await params;
  const session = await getB2BSession();

  // Redirect to login if not authenticated or wrong tenant
  if (!session.isLoggedIn) {
    redirect("/login");
  }

  // If logged in to a different tenant, redirect to login
  if (session.tenantId && session.tenantId !== tenant) {
    redirect("/login");
  }

  return <TenantAppLauncher tenant={tenant} />;
}
