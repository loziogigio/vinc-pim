import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { B2BLoginForm } from "@/components/b2b/LoginForm";

// Force dynamic rendering - uses cookies() for session
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "B2B Login - VINC Storefront",
  description: "Sign in to the B2B Product Catalog Manager",
};

export default async function LoginPage() {
  const session = await getB2BSession();

  // If already logged in, redirect to tenant B2B home
  if (session.isLoggedIn && session.tenantId) {
    redirect(`/${session.tenantId}/b2b`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <B2BLoginForm />
    </div>
  );
}
