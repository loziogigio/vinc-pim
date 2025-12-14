import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";

/**
 * Minimal layout for builder pages (home-builder, home-settings)
 * Only handles session check - no header/footer since these pages have their own full-screen UI
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

  return <>{children}</>;
}
