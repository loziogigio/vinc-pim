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
import {
  Building2,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
} from "lucide-react";

interface AuthShellProps {
  branding: TenantBranding | null;
  children: ReactNode;
  variant?: "default" | "tenant-default-theme";
  titleOverride?: string | null;
  appLabel?: string | null;
}

export function AuthShell({
  branding,
  children,
  variant = "default",
  titleOverride,
  appLabel,
}: AuthShellProps) {
  const accentColor = branding?.primaryColor || DEFAULT_ACCENT_COLOR;
  const useTenantDefaultTheme = variant === "tenant-default-theme";

  if (useTenantDefaultTheme) {
    return (
      <div className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_30%),linear-gradient(135deg,#f8fbff_0%,#eef4fb_45%,#e8eef7_100%)]">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute left-[8%] top-[12%] h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${accentColor}22` }} />
          <div className="absolute bottom-[14%] right-[10%] h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
        </div>

        <div className="relative min-h-screen w-full xl:grid xl:grid-cols-[40%_60%]">
          <div className="hidden bg-[linear-gradient(160deg,rgba(15,23,42,0.96)_0%,rgba(30,41,59,0.94)_42%,rgba(37,99,235,0.88)_100%)] text-white xl:flex xl:min-h-screen xl:justify-end">
            <div className="flex w-full max-w-[42rem] flex-col justify-center px-10 py-16 2xl:px-16">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100/90">
                  <CheckCircle2 className="h-4 w-4" />
                  {appLabel || "Accesso"}
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-100/75">
                    {branding?.title || "VendereInCloud"}
                  </p>
                  <h1 className="max-w-md text-4xl font-semibold leading-tight text-white">
                    {branding?.legalName || branding?.title || "VendereInCloud"}
                  </h1>
                  <p className="max-w-lg text-base leading-7 text-slate-200/88">
                    {branding?.description || "Accedi per visualizzare il tuo spazio digitale e gestire contenuti, accessi e informazioni riservate."}
                  </p>
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-inset ring-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                      <MapPin className="h-5 w-5 text-sky-100" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Address</p>
                      <div className="mt-2 space-y-1 text-sm leading-6 text-slate-200/80">
                        {branding?.addressLines?.length ? (
                          branding.addressLines.map((line) => (
                            <p
                              key={line}
                              className="border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
                            >
                              {line}
                            </p>
                          ))
                        ) : (
                          <p>{branding?.title || "VendereInCloud"}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-inset ring-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                      <Phone className="h-5 w-5 text-sky-100" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Contact</p>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200/80">
                        {branding?.phone && (
                          <a
                            href={`tel:${branding.phone.replace(/\s+/g, "")}`}
                            className="flex items-start gap-2 transition-colors hover:text-white"
                          >
                            <Phone className="mt-1 h-4 w-4 shrink-0 text-sky-100/90" />
                            <span>{branding.phone}</span>
                          </a>
                        )}
                        {branding?.email && (
                          <a
                            href={`mailto:${branding.email}`}
                            className="flex items-start gap-2 transition-colors hover:text-white"
                          >
                            <Mail className="mt-1 h-4 w-4 shrink-0 text-sky-100/90" />
                            <span>{branding.email}</span>
                          </a>
                        )}
                        {!branding?.phone && !branding?.email && (
                          <p>{branding?.description || "Contatta il tuo referente per ricevere assistenza sull'accesso."}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-inset ring-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                      <Building2 className="h-5 w-5 text-sky-100" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Company</p>
                      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200/80">
                        <p>{branding?.legalName || branding?.title || "VendereInCloud"}</p>
                        {branding?.vatNumber && (
                          <p className="flex items-start gap-2">
                            <ReceiptText className="mt-1 h-4 w-4 shrink-0 text-sky-100/90" />
                            <span>VAT {branding.vatNumber}</span>
                          </p>
                        )}
                        {branding?.websiteUrl && (
                          <a
                            href={branding.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-start gap-2 transition-colors hover:text-white"
                          >
                            <Globe className="mt-1 h-4 w-4 shrink-0 text-sky-100/90" />
                            <span>{branding.websiteUrl.replace(/^https?:\/\//, "")}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10 xl:bg-white/40 xl:backdrop-blur-[2px]">
            <div className="w-full max-w-[36rem] rounded-[32px] border border-white/60 bg-white/78 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur sm:p-8 lg:p-10">
              <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
                <div className="space-y-6">
                  <div className="flex justify-center xl:hidden">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm">
                      <CheckCircle2 className="h-4 w-4" style={{ color: accentColor }} />
                      {appLabel || "Accesso"}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
                      {branding?.logo ? (
                        <img
                          src={branding.logo}
                          alt={branding.title}
                          className="h-16 w-auto max-w-[220px] object-contain sm:h-[4.5rem]"
                        />
                      ) : (
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-bold text-white"
                          style={{ backgroundColor: accentColor }}
                        >
                          V
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {branding?.title || "VendereInCloud"}
                    </p>
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                      {`Accedi a ${appLabel || "Accesso"}`}
                    </h2>
                    <p className="mx-auto max-w-md text-sm leading-6 text-slate-600 sm:text-[15px]">
                      Effettua l&apos;accesso per visualizzare il portale. Se non hai un account, contatta il tuo referente commerciale.
                    </p>
                  </div>

                </div>

                {children}

                <div className="border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-500">
                    {branding?.shopUrl && (
                      <a href={branding.shopUrl} className="transition-colors hover:text-slate-700">
                        Torna al negozio
                      </a>
                    )}
                    {branding?.shopUrl && branding?.websiteUrl && (
                      <span className="text-slate-300">|</span>
                    )}
                    {branding?.websiteUrl && (
                      <a
                        href={branding.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors"
                        style={{ color: accentColor }}
                      >
                        Vai al sito istituzionale
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            {titleOverride || branding?.title || "VendereInCloud"}
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
