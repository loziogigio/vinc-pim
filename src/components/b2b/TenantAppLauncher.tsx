"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Newspaper } from "lucide-react";
import { getLauncherApps } from "@/config/apps.config";
import { useLayoutStore } from "@/lib/stores/layoutStore";
import { contentWidthClass } from "@/lib/utils/layout";
import { displayNameOf } from "@/lib/utils/user-display";
import type { HomeNewsItem, HomeNewsPageLink } from "@/lib/services/blog/home-news";
import { SuiteHeader } from "./SuiteHeader";

interface TenantAppLauncherProps {
  tenant: string;
  username?: string;
  email?: string;
  role?: string;
  /** Platform news feed (VendereInCloud blog), server-fetched. */
  news?: HomeNewsItem[];
  /** Platform static pages (guides/docs), shown as links alongside the news. */
  pages?: HomeNewsPageLink[];
}

// Temporary: hide the static placeholder KPIs until wired to real metrics.
const SHOW_KPIS: boolean = false;

/** Tag label for a news item: the resolved category, or a source-derived fallback. */
function newsTagLabel(item: HomeNewsItem): string {
  return item.category || (item.source === "central" ? "VendereInCloud" : "Novità");
}

export function TenantAppLauncher({ tenant, username, email, role, news, pages }: TenantAppLauncherProps) {
  const apps = getLauncherApps();
  const railApps = apps.filter((a) => a.id !== "home").slice(0, 6);
  const firstName = displayNameOf(username, email);
  const { fullWidth } = useLayoutStore();
  const [today, setToday] = useState("");

  const newsItems = news ?? [];
  const featured = newsItems[0];
  const restNews = newsItems.slice(1);
  const pageLinks = pages ?? [];

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    );
  }, []);

  return (
    <div className="vinc-login suite-bg min-h-screen">
      <SuiteHeader tenant={tenant} username={username} email={email} role={role} />

      <main className={`px-4 py-8 sm:px-6 sm:py-10 lg:px-8 ${contentWidthClass(fullWidth)}`}>
        {/* greeting + KPIs */}
        <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-10">
          <div className="flex-1">
            <p className="eyebrow capitalize">{today || " "}</p>
            <h1 className="c-ink mt-2.5 display text-3xl font-bold leading-[1.05] text-balance sm:text-[2.5rem]">
              Bentornato, <span className="c-accent">{firstName}</span>.
            </h1>
            <p className="c-ink-60 mt-2 text-[1.05rem]">
              Le ultime novità di <span className="c-ink font-semibold">{tenant}</span>, e i tuoi moduli a portata di clic.
            </p>
          </div>
          {SHOW_KPIS && (
            <div className="card flex items-stretch self-start px-2 py-3.5 lg:self-auto">
              <span className="kpi">
                <span className="display c-ink tnum text-2xl font-bold">128</span>
                <span className="mono c-ink-45 text-[0.62rem] uppercase tracking-wider">Ordini oggi</span>
              </span>
              <span className="kpi">
                <span className="display c-ink tnum text-2xl font-bold">3.257</span>
                <span className="mono c-ink-45 text-[0.62rem] uppercase tracking-wider">Carrelli attivi</span>
              </span>
              <span className="kpi">
                <span className="display c-ink tnum text-2xl font-bold">7</span>
                <span className="mono c-ink-45 text-[0.62rem] uppercase tracking-wider">Resi da evadere</span>
              </span>
            </div>
          )}
        </section>

        {/* body grid */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* LEFT — guides (top) + news stream */}
          <div>
            {pageLinks.length > 0 && (
              <section className="mb-9">
                <div className="mb-3.5 flex items-center gap-3">
                  <h2 className="eyebrow c-ink-45">Guide e risorse</h2>
                  <span className="bd-line h-px flex-1 border-t" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pageLinks.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/${tenant}/b2b/pagina/${p.slug}`}
                      className="card group flex items-center gap-3.5 p-4"
                    >
                      <span className="mic">
                        <BookOpen className="h-[19px] w-[19px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="c-ink block truncate text-[0.95rem] font-semibold leading-tight">
                          {p.title}
                        </span>
                        <span className="eyebrow mt-1 block">Guida</span>
                      </span>
                      <ArrowRight className="c-ink-25 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {featured ? (
              <>
                {/* featured = most recent post */}
                <section className="feat flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center">
                  <div className="relative z-10 flex-1">
                    <span className="ntag bg-white/15 text-white">★ {newsTagLabel(featured)}</span>
                    <h2 className="mt-3.5 display text-2xl font-bold leading-tight text-balance sm:text-[1.9rem]">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="mt-2.5 max-w-xl text-[0.98rem] text-white/80">{featured.excerpt}</p>
                    )}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      {featured.href && (
                        <Link
                          href={featured.href}
                          {...(featured.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[0.9rem] font-semibold text-[var(--vinc-deep)]"
                        >
                          Leggi
                          <ArrowRight className="h-[15px] w-[15px]" />
                        </Link>
                      )}
                      {featured.dateLabel && (
                        <span className="mono text-[0.72rem] text-white/65">{featured.dateLabel}</span>
                      )}
                    </div>
                  </div>
                  {featured.coverUrl && (
                    <div className="relative z-10 shrink-0 lg:w-[300px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={featured.coverUrl}
                        alt=""
                        className="h-40 w-full rounded-xl object-cover lg:h-44"
                      />
                    </div>
                  )}
                </section>

                {restNews.length > 0 && (
                  <>
                    <div className="mb-3.5 mt-8 flex items-center gap-3">
                      <h2 className="eyebrow c-ink-45">Novità &amp; aggiornamenti</h2>
                      <span className="bd-line h-px flex-1 border-t" />
                    </div>

                    <div className="space-y-4">
                      {restNews.map((n) => {
                        const titleClass =
                          "post-title c-ink mt-2.5 block display text-[1.25rem] font-bold leading-snug transition hover-accent";
                        return (
                          <article key={n.id} className="card post">
                            <div className="thumb">
                              {n.coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={n.coverUrl} alt="" className="h-full w-full rounded-[inherit] object-cover" />
                              ) : (
                                <Newspaper className="c-ink-25 h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2.5">
                                <span className={`ntag ${n.source === "central" ? "ntag-rel" : "ntag-gui"}`}>
                                  {newsTagLabel(n)}
                                </span>
                              </div>
                              {n.href ? (
                                n.external ? (
                                  <a href={n.href} target="_blank" rel="noopener noreferrer" className={titleClass}>
                                    {n.title}
                                  </a>
                                ) : (
                                  <Link href={n.href} className={titleClass}>
                                    {n.title}
                                  </Link>
                                )
                              ) : (
                                <p className={titleClass}>{n.title}</p>
                              )}
                              {n.excerpt && (
                                <p className="c-ink-60 mt-1.5 text-[0.9rem] leading-relaxed">{n.excerpt}</p>
                              )}
                              {n.dateLabel && (
                                <div className="c-ink-50 mt-3.5 flex items-center gap-2.5 text-[0.78rem]">
                                  <span className="mono text-[0.66rem]">{n.dateLabel}</span>
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            ) : (
              // Empty state: no posts from any source yet (or central feed not configured).
              <section className="card flex flex-col items-center justify-center gap-3.5 px-6 py-16 text-center sm:py-24">
                <span className="bd-line c-accent grid h-14 w-14 place-items-center rounded-2xl border">
                  <Newspaper className="h-6 w-6" />
                </span>
                <p className="eyebrow c-accent mt-1">Prossimamente</p>
                <h2 className="c-ink display text-2xl font-bold">Novità &amp; aggiornamenti</h2>
                <p className="c-ink-60 max-w-md text-[0.95rem] leading-relaxed">
                  Presto qui troverai notizie, rilasci e guide. Pubblica un articolo dal blog del tuo tenant per vederlo qui.
                </p>
              </section>
            )}

            <Link
              href={`/${tenant}/b2b/moduli`}
              className="card bd-line c-ink mt-5 flex items-center justify-center gap-1.5 py-3 text-[0.85rem] font-semibold hover-accent"
            >
              Vai al Centro Moduli
              <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
            </Link>
          </div>

          {/* RIGHT — modules + status */}
          <aside className="space-y-5">
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="display c-ink text-[1.05rem] font-bold">Moduli attivi</h2>
                <span className="mono text-[0.66rem] font-semibold text-[#1f9d6b]">{railApps.length} attivi</span>
              </div>
              <div className="-mx-1.5 mt-2">
                {railApps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <Link key={app.id} href={`/${tenant}${app.href}`} className="mrow">
                      <span className="mric">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="c-ink block text-[0.88rem] font-semibold leading-tight">{app.name}</span>
                        <span className="c-ink-50 block text-[0.7rem]">{app.description}</span>
                      </span>
                      <span className="pill-on ml-auto" />
                    </Link>
                  );
                })}
              </div>
              <Link
                href={`/${tenant}/b2b/moduli`}
                className="bd-line c-ink mt-2 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[0.82rem] font-semibold hover-accent"
              >
                Apri il Centro Moduli
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>

            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="display c-ink text-[1.05rem] font-bold">Stato del sistema</h2>
                <span className="mono inline-flex items-center gap-1.5 text-[0.66rem] font-semibold text-[#1f9d6b]">
                  <span className="stat-dot stat-ok pulse-dot" /> operativo
                </span>
              </div>
              <ul className="mt-4 space-y-2.5 text-[0.84rem]">
                {[
                  { dot: "stat-ok", label: "PIM & catalogo", value: "99,98%" },
                  { dot: "stat-warn", label: "Ricerca SolrCloud", value: "manutenzione" },
                  { dot: "stat-ok", label: "Pricing engine", value: "38 ms" },
                  { dot: "stat-ok", label: "Ordini & checkout", value: "99,99%" },
                  { dot: "stat-ok", label: "API gateway", value: "operativo" },
                ].map((s) => (
                  <li key={s.label} className="flex items-center gap-2.5">
                    <span className={`stat-dot ${s.dot}`} />
                    <span className="c-ink-60">{s.label}</span>
                    <span className="mono c-ink-40 ml-auto text-[0.62rem]">{s.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mono bd-line c-ink-40 mt-4 border-t pt-3.5 text-[0.62rem]">
                tenant {tenant} · db &amp; indice dedicati
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
