import { redirect } from "next/navigation";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { B2BLoginForm } from "@/components/b2b/LoginForm";

export const metadata = {
  title: "B2B Login - VINC Storefront",
  description: "Sign in to the B2B Product Catalog Manager",
};

export default async function B2BLoginPage() {
  const session = await getB2BSession();

  // If already logged in, redirect to dashboard
  if (session.isLoggedIn) {
    redirect("/b2b/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <B2BLoginForm />
    </div>
  );
}
