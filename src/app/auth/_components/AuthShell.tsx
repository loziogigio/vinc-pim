/**
 * AuthShell
 *
 * Shared chrome for the public auth pages (SSO login, forgot password):
 * the slate-gradient backdrop, the tenant logo / title block ("Accedi tramite
 * {tenant}"), the white card that wraps the form, and the footer
 * (copyright + "Torna al negozio" + "Vai al sito istituzionale").
 *
 * The page supplies whatever goes inside the card as `children`.
 */

import type { ReactNode } from "react";
import { DEFAULT_ACCENT_COLOR, type TenantBranding } from "./tenant-branding";

interface AuthShellProps {
  branding: TenantBranding | null;
  children: ReactNode;
}

export function AuthShell({ branding, children }: AuthShellProps) {
  const accentColor = branding?.primaryColor || DEFAULT_ACCENT_COLOR;

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

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8">
          {children}
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

          {/* Website link */}
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
