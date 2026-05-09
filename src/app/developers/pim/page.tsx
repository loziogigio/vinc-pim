import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DocsShell } from "@/components/developers/docs/DocsShell";
import { PIM_DOC_SECTIONS } from "@content/developers/pim/_sections";

export default function PimDocsIndexPage() {
  return (
    <DocsShell toc={[]}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#009688] no-underline">
        PIM API reference
      </p>
      <h1>Product Information Management</h1>
      <p className="lead">
        The PIM module is the canonical catalog for every tenant on VINC
        Commerce Suite. It stores products, categories, brands, media, and
        the attribute schema that downstream surfaces (storefront, B2B
        portal, Solr index, marketplace syncs) consume.
      </p>

      <p>
        All PIM endpoints live under <code>/api/b2b/pim</code> and require an
        authenticated tenant principal. See individual sections for schemas,
        filter parameters, and example payloads.
      </p>

      <div className="not-prose mt-8 grid gap-3 sm:grid-cols-2">
        {PIM_DOC_SECTIONS.map((section) => {
          const Icon = section.icon;
          const href = `/developers/pim/${section.slug}`;
          return (
            <Link
              key={section.slug}
              href={href}
              className="group flex items-start gap-3 rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#009688]/40 hover:shadow-[0_8px_24px_0_rgba(34,41,47,0.08)] dark:border-white/10 dark:bg-white/5 dark:hover:border-[#009688]/50"
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[0.358rem] bg-[rgba(0,150,136,0.12)] text-[#009688]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="mb-0.5 flex items-center gap-1.5 text-sm font-semibold text-[#5e5873] dark:text-slate-100">
                  {section.title}
                  <ArrowRight className="h-3.5 w-3.5 text-[#009688] opacity-0 transition group-hover:opacity-100" />
                </h3>
                <p className="text-xs leading-relaxed text-[#6e6b7b] dark:text-slate-400">
                  {section.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </DocsShell>
  );
}
