/**
 * SSO Forgot Password Page
 *
 * Allows users to reset their password by email.
 *
 * URL: /auth/forgot-password
 *
 * Query parameters:
 * - tenant_id: Tenant identifier (optional, can be entered in form)
 * - email: Pre-fill email field
 * - redirect_uri: Where to redirect after password reset
 */

import { Suspense } from "react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { Loader2 } from "lucide-react";
import { getHomeSettings } from "@/lib/db/home-settings";
import Link from "next/link";

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
    tenant_id?: string;
    email?: string;
    redirect_uri?: string;
    client_id?: string;
    state?: string;
  }>;
}

/**
 * Fetch tenant branding from home settings
 */
async function getTenantBranding(
  tenantId: string
): Promise<TenantBranding | null> {
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

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const { tenant_id, email, redirect_uri, client_id, state } = params;

  // Fetch tenant branding if tenant_id is provided
  const branding = tenant_id ? await getTenantBranding(tenant_id) : null;

  // Build login URL with preserved params
  const loginParams = new URLSearchParams();
  if (tenant_id) loginParams.set("tenant_id", tenant_id);
  if (client_id) loginParams.set("client_id", client_id);
  if (redirect_uri) loginParams.set("redirect_uri", redirect_uri);
  if (state) loginParams.set("state", state);
  const loginUrl = `/auth/login${loginParams.toString() ? `?${loginParams.toString()}` : ""}`;

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
          <p className="text-slate-500 mt-1">Recupera la tua password</p>

          {/* Website Link */}
          {branding?.websiteUrl && (
            <a
              href={branding.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 mt-2"
            >
              Visita il sito web
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>

        {/* Forgot Password Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8">
          {/* Info Message */}
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
            <p className="text-sm text-indigo-800">
              Inserisci il tuo indirizzo email e ti invieremo una password
              temporanea per accedere.
            </p>
          </div>

          {/* Forgot Password Form */}
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
              initialEmail={email}
              loginUrl={loginUrl}
            />
          </Suspense>
        </div>

        {/* Back to Login */}
        <div className="text-center mt-6">
          <Link
            href={loginUrl}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Torna al login
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Vendereincloud. Tutti i diritti
            riservati.
          </p>

          {/* Back to shop link */}
          {branding?.shopUrl && (
            <a
              href={branding.shopUrl}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mt-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Torna al negozio
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
