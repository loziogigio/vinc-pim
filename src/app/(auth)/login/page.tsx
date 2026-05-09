import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { B2BLoginForm } from "@/components/b2b/LoginForm";
import { LoginHero } from "@/components/b2b/LoginHero";

// Force dynamic rendering - uses cookies() for session
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — VendereInCloud CommerceSuite",
  description:
    "Sign in to VendereInCloud CommerceSuite — the multi-tenant platform for PIM, storefront, search, and B2B.",
};

export default async function LoginPage() {
  const session = await getB2BSession();

  // If already logged in, redirect to tenant B2B home
  if (session.isLoggedIn && session.tenantId) {
    redirect(`/${session.tenantId}/b2b`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop: split screen. Mobile/tablet: compact hero stacked above form. */}
      <div className="lg:hidden">
        <LoginHero compact />
      </div>
      <div className="grid lg:min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <LoginHero />
        </div>
        <div className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-10 lg:py-0">
          <B2BLoginForm />
        </div>
      </div>
    </div>
  );
}
