"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CircleAlert,
  Home as HomeIcon,
  LayoutGrid,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { getLauncherApps } from "@/config/apps.config";
import { useLayoutStore } from "@/lib/stores/layoutStore";
import { contentWidthClass } from "@/lib/utils/layout";
import { SuiteHeader } from "./SuiteHeader";

interface CommerceSuiteModuliProps {
  tenant: string;
  username?: string;
  email?: string;
  role?: string;
}

/**
 * Centro Moduli — the petrol internal-page template (app bar + breadcrumb +
 * sidebar + module cards). Active modules come from the real app registry and
 * link to the tenant-scoped routes.
 */
export function CommerceSuiteModuli({ tenant, username, email, role }: CommerceSuiteModuliProps) {
  const apps = getLauncherApps().filter((a) => a.id !== "home");
  const total = apps.length;
  const { fullWidth } = useLayoutStore();

  return (
    <div className="vinc-login suite-bg min-h-screen">
      <SuiteHeader tenant={tenant} username={username} email={email} role={role} />

      <main className={`px-4 py-7 sm:px-6 lg:px-8 ${contentWidthClass(fullWidth)}`}>
        {/* breadcrumb */}
        <nav className="c-ink-50 mb-5 flex items-center gap-2 text-[0.8rem]" aria-label="Percorso">
          <Link href={`/${tenant}/b2b`} className="hover-accent inline-flex items-center gap-1.5">
            <HomeIcon className="h-3.5 w-3.5" />
            Home
          </Link>
          <ArrowRight className="c-ink-25 h-3 w-3" />
          <span className="c-ink font-medium">Centro Moduli</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[224px_1fr]">
          {/* sidebar */}
          <aside className="self-start lg:sticky lg:top-[86px]">
            <div className="card p-3">
              <p className="navlabel mb-1.5">Moduli</p>
              <nav className="space-y-0.5">
                <a href="#attivi" className="navitem active">
                  <LayoutGrid className="h-[17px] w-[17px]" />
                  Tutti i moduli
                  <span className="nbadge">{total}</span>
                </a>
                <a href="#attivi" className="navitem">
                  <BadgeCheck className="h-[17px] w-[17px]" />
                  Attivi
                  <span className="nbadge">{total}</span>
                </a>
                <a href="#nonattivi" className="navitem">
                  <CircleAlert className="h-[17px] w-[17px]" />
                  Non attivi
                  <span className="nbadge">0</span>
                </a>
                <a href="#attivi" className="navitem">
                  <RefreshCw className="h-[17px] w-[17px]" />
                  Aggiornamenti
                  <span className="nbadge">2</span>
                </a>
              </nav>

              <p className="navlabel mb-1.5 mt-4">Tenant</p>
              <nav className="space-y-0.5">
                <Link href={`/${tenant}/b2b/pricing`} className="navitem">
                  <BarChart3 className="h-[17px] w-[17px]" />
                  Piano &amp; utilizzo
                </Link>
                <Link href={`/${tenant}/b2b/admin`} className="navitem">
                  <ShieldCheck className="h-[17px] w-[17px]" />
                  Sicurezza
                </Link>
              </nav>

              <div className="bd-line mt-4 rounded-xl border bg-[color:color-mix(in_oklab,var(--vinc-paper)_70%,#fff)] p-3.5">
                <p className="mono c-ink-45 text-[0.6rem] uppercase tracking-wider">Piano attuale</p>
                <p className="display c-ink mt-0.5 text-[1rem] font-bold">Suite · Pro</p>
                <p className="c-ink-50 mt-0.5 text-[0.74rem]">{total} moduli attivi</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--vinc-ink)_8%,transparent)]">
                  <span className="block h-full rounded-full bg-[var(--vinc-accent)]" style={{ width: "100%" }} />
                </div>
              </div>
            </div>
          </aside>

          {/* content */}
          <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h1 className="c-ink display text-3xl font-bold leading-tight sm:text-[2.1rem]">Centro Moduli</h1>
                <p className="c-ink-60 mt-1.5 text-[1rem]">Apri e configura i moduli della tua CommerceSuite.</p>
              </div>
              <label className="bd-line flex w-full items-center gap-2 rounded-xl border bg-[var(--vinc-surface)] px-3 py-2.5 transition focus-within:border-[var(--vinc-accent)] sm:w-64">
                <Search className="c-ink-40 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Filtra moduli…"
                  className="vinc-search c-ink w-full text-[0.86rem] placeholder:text-[color:color-mix(in_oklab,var(--vinc-ink)_40%,transparent)]"
                />
              </label>
            </div>

            {/* summary */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="sumcard">
                <span className="display c-ink tnum text-2xl font-bold">{total}</span>
                <span className="mono c-ink-45 text-[0.62rem] uppercase tracking-wider">Moduli totali</span>
              </div>
              <div className="sumcard">
                <span className="display tnum text-2xl font-bold text-[#1f8a5e]">{total}</span>
                <span className="mono c-ink-45 text-[0.62rem] uppercase tracking-wider">Attivi</span>
              </div>
              <div className="sumcard">
                <span className="display c-ink tnum text-2xl font-bold">0</span>
                <span className="mono c-ink-45 text-[0.62rem] uppercase tracking-wider">Da attivare</span>
              </div>
              <div className="sumcard">
                <span className="display c-accent tnum text-2xl font-bold">2</span>
                <span className="mono c-ink-45 text-[0.62rem] uppercase tracking-wider">Aggiornamenti</span>
              </div>
            </div>

            {/* active modules */}
            <section id="attivi" className="mt-9 scroll-mt-24">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="display c-ink text-[1.15rem] font-bold">Moduli attivi</h2>
                <span className="status status-on">{total} attivi</span>
                <span className="bd-line h-px flex-1 border-t" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {apps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <Link key={app.id} href={`/${tenant}${app.href}`} className="mcard">
                      <div className="flex items-start justify-between">
                        <span className="mic">
                          <Icon className="h-[22px] w-[22px]" />
                        </span>
                        <span className="status status-on">attivo</span>
                      </div>
                      <h3 className="display c-ink mt-3.5 text-[1.05rem] font-bold">{app.name}</h3>
                      <p className="c-ink-60 mt-1 text-[0.84rem] leading-snug">{app.description}</p>
                      <div className="mt-auto flex items-center justify-between pt-4">
                        <span className="mono c-ink-40 text-[0.62rem]">{tenant}</span>
                        <span className="btn-open">
                          Apri
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* not active — empty state */}
            <section id="nonattivi" className="mt-11 scroll-mt-24">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="display c-ink text-[1.15rem] font-bold">Non attivi</h2>
                <span className="status status-off">0 disponibili</span>
                <span className="bd-line h-px flex-1 border-t" />
              </div>
              <div className="card flex items-center gap-3 p-6">
                <BadgeCheck className="c-accent h-6 w-6" />
                <p className="c-ink-60 text-[0.9rem]">
                  Tutti i moduli inclusi nel tuo piano sono già attivi su <span className="c-ink font-semibold">{tenant}</span>.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
