import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Public_Sans } from "next/font/google";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { DashboardHeader } from "@/components/b2b/DashboardHeader";
import type { B2BSessionData } from "@/lib/types/b2b";
import { cn } from "@/components/ui/utils";

// Force dynamic rendering - layout uses cookies() for session
export const dynamic = 'force-dynamic';

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * Layout for builder pages (home-builder, home-settings)
 * Includes DashboardHeader for consistent navigation
 */
export default async function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getB2BSession();

  // Redirect to login if not authenticated
  if (!session.isLoggedIn) {
    redirect("/b2b/login");
  }

  // Validate URL tenant matches session tenant
  const headersList = await headers();
  const urlTenant = headersList.get("x-resolved-tenant-id");

  // If URL has a different tenant than session, redirect to correct URL
  if (urlTenant && urlTenant !== session.tenantId) {
    // Get the original pathname from middleware header
    const originalPath = headersList.get("x-original-pathname") || "/b2b";
    // Extract the path after /b2b (e.g., /home-builder, /mobile-builder)
    const pathMatch = originalPath.match(/\/b2b(\/.*)?$/);
    const subPath = pathMatch ? pathMatch[1] || "" : "";

    // Redirect to the correct tenant URL
    redirect(`/${session.tenantId}/b2b${subPath}`);
  }

  // Serialize session to plain object for Client Component
  const sessionData: B2BSessionData = {
    isLoggedIn: session.isLoggedIn,
    tenantId: session.tenantId,
    userId: session.userId,
    username: session.username,
    email: session.email,
    role: session.role,
    companyName: session.companyName,
    lastLoginAt: session.lastLoginAt,
  };

  return (
    <div className={cn(publicSans.className, "min-h-screen bg-[#f5f6fa] text-[#5e5873]")}>
      <DashboardHeader session={sessionData} />
      {children}
    </div>
  );
}
