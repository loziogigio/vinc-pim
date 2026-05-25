"use client";

import Image from "next/image";
import Link from "next/link";
import { Briefcase, Package, Search, Store } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Marketing panel rendered alongside the sign-in form on `/login`.
 *
 * On lg+ viewports it occupies the left half of the split layout.
 * Below lg it collapses to a compact hero strip above the form — see
 * `compact` prop.
 */
interface LoginHeroProps {
  /** When true, renders the condensed version used above the form on smaller screens. */
  compact?: boolean;
}

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
      <div className="relative overflow-hidden bg-gradient-to-br from-[rgba(0,150,136,0.12)] via-[rgba(0,150,136,0.04)] to-transparent px-6 py-8 dark:from-[rgba(0,150,136,0.18)] dark:via-[rgba(0,150,136,0.08)]">
        <BackgroundGlow />
        <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
          <Image
            src="/vinc-bc.png"
            alt="VendereInCloud"
            width={72}
            height={72}
            priority
            className="mb-3"
          />
          <h1 className="text-lg font-semibold leading-snug text-foreground">
            {t("login.hero.title")}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {t("login.hero.subtitle")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {modules.map((m) => (
              <span
                key={m.title}
                className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-0.5 text-[11px] font-semibold text-primary shadow-sm ring-1 ring-primary/20"
              >
                <m.icon className="h-3 w-3" />
                {m.title}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden bg-gradient-to-br from-[rgba(0,150,136,0.14)] via-[rgba(0,150,136,0.05)] to-transparent px-10 py-12 dark:from-[rgba(0,150,136,0.2)] dark:via-[rgba(0,150,136,0.08)]">
      <BackgroundGlow />

      <div className="relative flex items-center gap-2">
        <Image
          src="/vinc-bc.png"
          alt="VendereInCloud"
          width={44}
          height={44}
          priority
        />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          VendereInCloud
        </span>
      </div>

      <div className="relative mt-auto flex max-w-[520px] flex-col">
        <h1 className="text-[2.25rem] font-semibold leading-[1.15] tracking-tight text-foreground">
          {t("login.hero.title")}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          {t("login.hero.subtitle")}
        </p>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <li
                key={m.title}
                className="group flex items-start gap-3 rounded-[0.428rem] border border-border/80 bg-card/65 p-3 backdrop-blur-sm transition hover:border-primary/40 hover:bg-card/90"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[0.358rem] bg-primary/10 text-primary transition group-hover:bg-primary/20">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {m.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    {m.desc}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative mt-10 flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>
          {t("login.copyright", { year: new Date().getFullYear().toString() })}
        </span>
        <Link
          href="/developers"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {t("login.developerDocsLink")} →
        </Link>
      </div>
    </section>
  );
}

function BackgroundGlow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-24 h-[360px] w-[360px] rounded-full bg-primary/20 blur-[120px] dark:bg-primary/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-[300px] w-[300px] rounded-full bg-emerald-500/10 blur-[110px] dark:bg-emerald-500/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,150,136,0.25) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
    </>
  );
}
