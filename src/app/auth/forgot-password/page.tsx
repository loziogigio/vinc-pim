/**
 * Forgot Password Page
 *
 * Reached from the "Password dimenticata?" link on the SSO login page.
 * Shares the same shell as /auth/login (see AuthShell) so it feels like a
 * continuation of the login flow rather than a separate section.
 *
 * URL: /auth/forgot-password
 *
 * Query parameters (all optional, forwarded back to /auth/login):
 * - tenant_id, client_id, redirect_uri, state
 * - email: pre-fill the email field
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthShell } from "../_components/AuthShell";
import { getTenantBranding } from "../_components/tenant-branding";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recupera password — VINC Commerce Suite",
  description: "Recupera l'accesso al tuo account VINC Commerce Suite.",
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

  // Fetch tenant branding if tenant_id is provided (same as /auth/login)
  const branding = tenant_id ? await getTenantBranding(tenant_id) : null;

  // Build the back-to-login URL, preserving the OAuth params
  const loginParams = new URLSearchParams();
  if (tenant_id) loginParams.set("tenant_id", tenant_id);
  if (client_id) loginParams.set("client_id", client_id);
  if (redirect_uri) loginParams.set("redirect_uri", redirect_uri);
  if (state) loginParams.set("state", state);
  const loginUrl = `/auth/login${loginParams.toString() ? `?${loginParams.toString()}` : ""}`;

  return (
    <AuthShell branding={branding}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        }
      >
        <ForgotPasswordForm
          tenantId={tenant_id}
          tenantName={branding?.title}
          primaryColor={branding?.primaryColor}
          initialEmail={email}
          loginUrl={loginUrl}
        />
      </Suspense>
    </AuthShell>
  );
}
