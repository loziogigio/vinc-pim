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
import { LoginForm } from "./LoginForm";
import { Loader2 } from "lucide-react";
import { getHomeSettings } from "@/lib/db/home-settings";

// Force dynamic rendering since this page uses searchParams
export const dynamic = "force-dynamic";

interface TenantBranding {
  title: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  shopUrl: string | null;
  websiteUrl: string | null;
}

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

/**
 * Fetch tenant branding from home settings
 */
async function getTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  try {
    const tenantDb = `vinc-${tenantId}`;
    const settings = await getHomeSettings(tenantDb);

    if (!settings || !settings.branding) {
      return null;
    }

    return {
      title: settings.branding.title || tenantId,
      logo: settings.branding.logo || null,
      favicon: settings.branding.favicon || null,
      primaryColor: settings.branding.primaryColor || "#6366f1",
      shopUrl: settings.branding.shopUrl || null,
      websiteUrl: settings.branding.websiteUrl || null,
    };
  } catch (error) {
    console.error("Error fetching tenant branding:", error);
    return null;
  }
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;

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
  } = params;

  // Fetch tenant branding if tenant_id is provided
  const branding = tenant_id ? await getTenantBranding(tenant_id) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          {branding?.logo ? (
            <div className="mb-4">
              <img
                src={branding.logo}
                alt={branding.title}
                className="h-16 max-w-[200px] mx-auto object-contain"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
              <span className="text-3xl font-bold text-white">V</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">
            {branding?.title || "VINC Commerce Suite"}
          </h1>
          <p className="text-slate-500 mt-1">Accedi al tuo account</p>

          {/* Website Link */}
          {branding?.websiteUrl && (
            <a
              href={branding.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 mt-2"
            >
              Visita il sito web
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-sm font-medium text-red-800">{error}</p>
              {error_description && (
                <p className="text-sm text-red-600 mt-1">{error_description}</p>
              )}
            </div>
          )}

          {/* Client Info */}
          {client_id && client_id !== "vinc-commerce-suite" && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                <span className="font-medium">{getClientName(client_id)}</span> richiede l'accesso
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
              redirectUri={redirect_uri}
              state={state}
              prompt={prompt}
              codeChallenge={code_challenge}
              codeChallengeMethod={code_challenge_method}
            />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Vendereincloud. Tutti i diritti riservati.
          </p>

          {/* Back to shop link */}
          {branding?.shopUrl && (
            <a
              href={branding.shopUrl}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mt-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Torna al negozio
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get friendly name for OAuth client.
 */
function getClientName(clientId: string): string {
  const names: Record<string, string> = {
    "vinc-b2b": "VINC B2B Portal",
    "vinc-vetrina": "VINC Vetrina",
    "vinc-commerce-suite": "VINC Commerce Suite",
    "vinc-mobile": "VINC Mobile App",
    "vinc-pim": "VINC PIM",
  };

  return names[clientId] || clientId;
}
