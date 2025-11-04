import { redirect } from "next/navigation";
import { Public_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { DashboardHeader } from "@/components/b2b/DashboardHeader";
import type { B2BSessionData } from "@/lib/types/b2b";
import { cn } from "@/components/ui/utils";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default async function B2BProtectedLayout({
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
    userId: session.userId,
    username: session.username,
    email: session.email,
    role: session.role,
    companyName: session.companyName,
    lastLoginAt: session.lastLoginAt,
  };

  return (
    <div className={cn(publicSans.className, "min-h-screen bg-[#f8f7fa] text-[#5e5873]")}>
      <Toaster position="top-right" richColors />
      <DashboardHeader session={sessionData} notificationCount={3} />
      <main className="mx-auto max-w-[1600px] px-8 pb-10 pt-6">
        {children}
      </main>
    </div>
  );
}
