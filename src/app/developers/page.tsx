import Link from "next/link";
import { ArrowRight, Package, Users } from "lucide-react";
import { DocsTopNav } from "@/components/developers/docs/DocsTopNav";

const SURFACES = [
  {
    href: "/developers/pim",
    title: "PIM API",
    description:
      "Products, categories, brands, imports, and everything else in the Product Information Management module.",
    icon: Package,
    available: true,
  },
  {
    href: "/developers/customers",
    title: "Customers & Users API",
    description:
      "Bulk-import companies (customers) with their addresses, and the portal users who log in on their behalf.",
    icon: Users,
    available: true,
  },
];

export default function DevelopersPortalPage() {
  return (
    <div className="min-h-screen bg-white text-[#5e5873] dark:bg-[#0f1419] dark:text-slate-200">
      <DocsTopNav />
      <div className="mx-auto max-w-[1000px] px-4 lg:px-6 py-16">
        <div className="mb-12">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#009688]">
            Developer documentation
          </p>
          <h1 className="text-3xl font-semibold text-[#5e5873] dark:text-slate-100">
            Build on VINC Commerce Suite
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6e6b7b] dark:text-slate-400">
            Reference for the REST APIs, data models, and authentication flows
            exposed by the VINC Commerce Suite. All endpoints are versioned
            under <code className="rounded bg-[#f0f0f3] px-1 py-0.5 font-mono text-xs text-[#009688] dark:bg-white/10">/api/b2b/*</code>{" "}
            and authenticated with a session, bearer token, or tenant API key.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SURFACES.map((surface) => {
            const Icon = surface.icon;
            return (
              <Link
                key={surface.href}
                href={surface.href}
                className="group relative overflow-hidden rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_32px_0_rgba(34,41,47,0.12)] dark:border-white/10 dark:bg-white/5"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[0.358rem] bg-[rgba(0,150,136,0.12)] text-[#009688]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-[#5e5873] dark:text-slate-100">
                  {surface.title}
                  <ArrowRight className="h-4 w-4 text-[#009688] opacity-0 transition group-hover:opacity-100" />
                </h2>
                <p className="text-sm leading-relaxed text-[#6e6b7b] dark:text-slate-400">
                  {surface.description}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 border-t border-[#ebe9f1] pt-6 dark:border-white/10">
          <h3 className="mb-2 text-sm font-semibold text-[#5e5873] dark:text-slate-200">
            Conventions
          </h3>
          <ul className="space-y-1.5 text-sm text-[#6e6b7b] dark:text-slate-400">
            <li>
              <strong className="text-[#5e5873] dark:text-slate-200">Base URL:</strong>{" "}
              <code className="font-mono text-xs">https://cs.vendereincloud.it</code>
            </li>
            <li>
              <strong className="text-[#5e5873] dark:text-slate-200">Response envelope:</strong>{" "}
              <code className="font-mono text-xs">{"{ success: true, data: ... }"}</code>{" "}
              on success;{" "}
              <code className="font-mono text-xs">{"{ error: \"...\" }"}</code>{" "}
              with an HTTP 4xx/5xx on error.
            </li>
            <li>
              <strong className="text-[#5e5873] dark:text-slate-200">Pagination:</strong>{" "}
              Server-side with <code className="font-mono text-xs">page</code> and{" "}
              <code className="font-mono text-xs">limit</code> query params.
            </li>
            <li>
              <strong className="text-[#5e5873] dark:text-slate-200">Field naming:</strong>{" "}
              <code className="font-mono text-xs">snake_case</code> in requests and
              responses.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
