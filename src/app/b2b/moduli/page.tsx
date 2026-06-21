import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { CommerceSuiteModuli } from "@/components/b2b/CommerceSuiteModuli";

// Served at /b2b/moduli — reached via the proxy rewrite of /{tenant}/b2b/moduli.
// Lives outside the (protected) group so it renders its own SuiteHeader chrome
// via CommerceSuiteModuli rather than inheriting the protected layout.
export const dynamic = "force-dynamic";

export default async function ModuliPage() {
  const session = await getB2BSession();

  if (!session.isLoggedIn || !session.tenantId) {
    redirect("/login");
  }

  return (
    <CommerceSuiteModuli
      tenant={session.tenantId}
      username={session.username}
      email={session.email}
      role={session.role}
    />
  );
}
