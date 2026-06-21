import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Accedi · CommerceSuite — Vendere in Cloud",
};

/** Brand-panel feature cards (left side). */
const SUITE_FEATURES = [
  {
    title: "PIM",
    description: "Il catalogo di record: prodotti, varianti e media.",
    icon: (
      <>
        <path d="m21 16-9 5-9-5V8l9-5 9 5z" />
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
      </>
    ),
  },
  {
    title: "Storefront",
    description: "E-commerce pubblico renderizzato dal PIM.",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
      </>
    ),
  },
  {
    title: "Ricerca",
    description: "Faccette e sinonimi SolrCloud, per tenant.",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
  },
  {
    title: "Portale B2B",
    description: "Ordini rivenditori, prezzi a contratto, approvazioni.",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
  },
];

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session.isLoggedIn) {
    redirect("/admin/page-builder");
  }

  return (
    <div className="vinc-login min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ================= BRAND PANEL ================= */}
      <section className="brand hidden lg:flex flex-col justify-between text-white px-10 xl:px-16 py-10">
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 border border-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/vinc-logo.png"
              alt=""
              width={26}
              height={26}
              className="h-[26px] w-[26px]"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </span>
          <span className="display text-[1.2rem] font-bold tracking-tight">
            vendere<span className="text-white/70">in</span>cloud
          </span>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/70">
            Commerce Suite · multi-tenant
          </p>
          <h1 className="mt-4 display text-4xl xl:text-[3.1rem] font-bold leading-[1.05] text-balance">
            Tutto quello che vendi,
            <br />
            in un&apos;unica suite.
          </h1>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-white/80 max-w-md">
            Catalogo, storefront, ricerca e portale B2B su un&apos;unica piattaforma — prezzi serviti
            in tempo reale dal tuo gestionale.
          </p>

          <div className="mt-9 grid sm:grid-cols-2 gap-3.5 max-w-2xl">
            {SUITE_FEATURES.map((feature) => (
              <div key={feature.title} className="brand-card flex gap-3.5 p-4">
                <span className="bicon">
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {feature.icon}
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-[0.95rem]">{feature.title}</p>
                  <p className="text-[0.8rem] text-white/70 leading-snug mt-0.5">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-white/65">
          <p className="mono text-[0.72rem]">© 2026 vendereincloud</p>
          <div className="flex items-center gap-5 mono text-[0.72rem]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white/80 pulse-dot" />
              tutti i sistemi operativi
            </span>
          </div>
        </div>
      </section>

      {/* ================= FORM PANEL ================= */}
      <LoginForm />
    </div>
  );
}
