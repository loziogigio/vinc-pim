import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { AppLauncher } from "@/components/b2b/AppLauncher";

// Force dynamic rendering for auth check
export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await getB2BSession();

  // If not logged in, redirect to login
  if (!session.isLoggedIn) {
    redirect("/b2b/login");
  }

  return <AppLauncher />;
}
