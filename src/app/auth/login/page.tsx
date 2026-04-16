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
import { getTenantModel } from "@/lib/db/models/admin-tenant";

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
    // Fetch home settings branding and admin tenant name in parallel
    const tenantDb = `vinc-${tenantId}`;
    const [settings, adminTenant] = await Promise.all([
      getHomeSettings(tenantDb).catch(() => null),
      getTenantModel().then(m => m.findByTenantId(tenantId)).catch(() => null),
    ]);

    const branding = settings?.branding;
    const adminName = adminTenant?.name;

    // Use branding title, fall back to admin tenant name, then tenant_id
    const title = branding?.title || adminName || tenantId;

    return {
      title,
      logo: branding?.logo || null,
      favicon: branding?.favicon || null,
      primaryColor: branding?.primaryColor || "#6366f1",
      shopUrl: branding?.shopUrl || null,
      websiteUrl: branding?.websiteUrl || null,
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

  // Use branding primaryColor for accent theming
  const accentColor = branding?.primaryColor || "#6366f1";

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
                className="h-20 max-w-[280px] mx-auto object-contain"
              />
            </div>
          ) : (
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ backgroundColor: accentColor }}
            >
              <span className="text-3xl font-bold text-white">V</span>
            </div>
          )}
          <p className="text-sm text-slate-400 mb-1">Accedi tramite</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {branding?.title || "VendereInCloud"}
          </h1>
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

          {/* Client Info - only show for non-B2B OAuth clients */}
          {client_id && client_id !== "vinc-commerce-suite" && client_id !== "vinc-b2b" && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                Accesso tramite <span className="font-medium">{getClientName(client_id)}</span>
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
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 mt-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Vendereincloud. Tutti i diritti riservati.
          </p>

          {/* Back to shop link */}
          {branding?.shopUrl && (
            <a
              href={branding.shopUrl}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Torna al negozio
            </a>
          )}

          {/* Website Link */}
          {branding?.websiteUrl && (
            <a
              href={branding.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: accentColor }}
            >
              Vai al sito istituzionale
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
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
