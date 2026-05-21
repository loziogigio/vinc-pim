/**
 * SSO Login Page
 *
 * Centralized login page for all VINC applications.
 *
 * URL: /auth/login
 *
 * Query parameters:
 * - client_id: OAuth client requesting authentication
 * - tenant_id: Tenant identifier
 * - redirect_uri: Where to redirect after successful login
 * - state: OAuth state parameter for CSRF protection
 * - prompt: "none" for silent SSO (skip login form if already authenticated)
 * - code_challenge: PKCE code challenge
 * - code_challenge_method: PKCE method (plain or S256)
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { AuthShell } from "../_components/AuthShell";
import { getAuthClientLabel } from "../_components/client-labels";
import { getTenantBranding } from "../_components/tenant-branding";

// Force dynamic rendering since this page uses searchParams
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    client_id?: string;
    tenant_id?: string;
    redirect_uri?: string;
    state?: string;
    prompt?: string;
    code_challenge?: string;
    code_challenge_method?: "plain" | "S256";
    error?: string;
    error_description?: string;
  }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const {
    client_id,
    tenant_id,
    redirect_uri,
    state,
    prompt,
    code_challenge,
    code_challenge_method,
    error,
    error_description,
  } = await searchParams;

  // Fetch tenant branding if tenant_id is provided
  const branding = tenant_id ? await getTenantBranding(tenant_id) : null;
  const clientLabel = getAuthClientLabel(client_id);
  const shellVariant =
    (client_id === "vinc-b2b" || client_id === "vinc-vetrina") &&
    branding?.b2bTheme === "default"
      ? "tenant-default-theme"
      : "default";
  const shellAppLabel =
    client_id === "vinc-vetrina" ? "Ufficio Digitale" : "Portale B2B";

  return (
    <AuthShell
      branding={branding}
      variant={shellVariant}
      titleOverride={client_id === "vinc-vetrina" ? clientLabel : null}
      appLabel={shellVariant === "tenant-default-theme" ? shellAppLabel : null}
    >
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm font-medium text-red-800">{error}</p>
          {error_description && (
            <p className="text-sm text-red-600 mt-1">{error_description}</p>
          )}
        </div>
      )}

      {/* Client Info - only show for non-B2B OAuth clients */}
      {client_id && client_id !== "vinc-commerce-suite" && client_id !== "vinc-b2b" && (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-600">
            Accesso tramite{" "}
            <span className="font-medium">{clientLabel}</span>
          </p>
        </div>
      )}

      {/* Login Form */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        }
      >
        <LoginForm
          clientId={client_id}
          tenantId={tenant_id}
          tenantName={branding?.title}
          tenantLogo={branding?.logo}
          primaryColor={branding?.primaryColor}
          redirectUri={redirect_uri}
          state={state}
          prompt={prompt}
          codeChallenge={code_challenge}
          codeChallengeMethod={code_challenge_method}
        />
      </Suspense>
    </AuthShell>
  );
}
