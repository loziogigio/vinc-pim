"use client";

import Image from "next/image";
import Link from "next/link";
import { Briefcase, Package, Search, Store } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Marketing panel rendered alongside the sign-in form on `/login`.
 *
 * Renders the VINC Commerce Suite "petrol" brand panel: a full-bleed petrol
 * gradient with a dotted overlay, the inverted (white) logo + wordmark, the
 * headline/subtitle and the four product modules as translucent glass cards.
 *
 * On lg+ viewports it occupies the left half of the split layout. Below lg it
 * collapses to a compact strip above the form — see `compact`.
 *
 * Visual tokens (.brand / .brand-card / .bicon / .display / .mono) come from
 * the `.vinc-login` scope on the page wrapper.
 */
interface LoginHeroProps {
  /** When true, renders the condensed version used above the form on smaller screens. */
  compact?: boolean;
}

/** Inverts the petrol logo to a white silhouette so it reads on the gradient. */
const WHITE_LOGO_STYLE = { filter: "brightness(0) invert(1)" } as const;

export function LoginHero({ compact = false }: LoginHeroProps) {
  const { t } = useTranslation();
  const modules = [
    { icon: Package, title: t("login.modules.pimTitle"), desc: t("login.modules.pimDesc") },
    { icon: Store, title: t("login.modules.storefrontTitle"), desc: t("login.modules.storefrontDesc") },
    { icon: Search, title: t("login.modules.searchTitle"), desc: t("login.modules.searchDesc") },
    { icon: Briefcase, title: t("login.modules.b2bTitle"), desc: t("login.modules.b2bDesc") },
  ];

  if (compact) {
    return (
      <div className="brand relative overflow-hidden px-6 py-8 text-white">
        <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center text-center">
          <span className="mb-3 grid h-14 w-14 place-items-center rounded-xl border border-white/20 bg-white/15">
            <Image src="/vinc-logo.png" alt="VendereInCloud" width={32} height={32} priority style={WHITE_LOGO_STYLE} />
          </span>
          <h1 className="display text-lg font-bold leading-snug">{t("login.hero.title")}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">{t("login.hero.subtitle")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <span
                  key={m.title}
                  className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/20"
                >
                  <Icon className="h-3 w-3" />
                  {m.title}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="brand relative flex h-full flex-col justify-between overflow-hidden px-10 py-12 text-white xl:px-16">
      {/* logo + wordmark */}
      <div className="relative z-10 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/15">
          <Image src="/vinc-logo.png" alt="VendereInCloud" width={26} height={26} priority style={WHITE_LOGO_STYLE} />
        </span>
        <span className="display text-[1.2rem] font-bold tracking-tight">
          vendere<span className="text-white/70">in</span>cloud
        </span>
      </div>

      {/* headline + modules */}
      <div className="relative z-10 max-w-xl">
        <p className="mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/70">
          Commerce Suite · multi-tenant
        </p>
        <h1 className="mt-4 display text-4xl font-bold leading-[1.05] text-balance xl:text-[3.1rem]">
          {t("login.hero.title")}
        </h1>
        <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-white/80">
          {t("login.hero.subtitle")}
        </p>

        <ul className="mt-9 grid max-w-2xl gap-3.5 sm:grid-cols-2">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <li key={m.title} className="brand-card flex gap-3.5 p-4">
                <span className="bicon">
                  <Icon className="h-[19px] w-[19px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.95rem] font-semibold">{m.title}</p>
                  <p className="mt-0.5 text-[0.8rem] leading-snug text-white/70">{m.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* footer */}
      <div className="relative z-10 flex items-center justify-between text-white/65">
        <span className="mono text-[0.72rem]">
          {t("login.copyright", { year: new Date().getFullYear().toString() })}
        </span>
        <Link
          href="/developers"
          className="mono text-[0.72rem] font-medium text-white/80 transition-colors hover:text-white"
        >
          {t("login.developerDocsLink")} →
        </Link>
      </div>
    </section>
  );
}
