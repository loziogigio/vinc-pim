import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginHero } from "@/components/b2b/LoginHero";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Forgot password — VendereInCloud CommerceSuite",
  description: "Recover access to your VendereInCloud tenant.",
};

interface PageProps {
  searchParams: Promise<{
    tenant_id?: string;
    email?: string;
    redirect_uri?: string;
    client_id?: string;
    state?: string;
  }>;
}

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const { tenant_id, email, redirect_uri, client_id, state } =
    await searchParams;

  const loginParams = new URLSearchParams();
  if (tenant_id) loginParams.set("tenant_id", tenant_id);
  if (client_id) loginParams.set("client_id", client_id);
  if (redirect_uri) loginParams.set("redirect_uri", redirect_uri);
  if (state) loginParams.set("state", state);
  const loginUrl = `/auth/login${loginParams.toString() ? `?${loginParams.toString()}` : ""}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="lg:hidden">
        <LoginHero compact />
      </div>
      <div className="grid lg:min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <LoginHero />
        </div>
        <div className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-10 lg:py-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
              </div>
            }
          >
            <ForgotPasswordForm
              tenantId={tenant_id}
              initialEmail={email}
              loginUrl={loginUrl}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
