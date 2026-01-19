import { redirect } from "next/navigation";
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
