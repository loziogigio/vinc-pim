import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DocsShell } from "@/components/developers/docs/DocsShell";
import { CUSTOMERS_DOC_SECTIONS } from "@content/developers/customers/_sections";

export default function CustomersDocsIndexPage() {
  return (
    <DocsShell toc={[]}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#009688] no-underline">
        Customers &amp; Users API reference
      </p>
      <h1>Customers &amp; Users</h1>
      <p className="lead">
        Two asynchronous bulk-import endpoints let an external system — an ERP,
        a legacy storefront, a partner integration — push the B2B customer base
        into a tenant: <strong>companies</strong> (with their delivery and
        billing addresses) and the <strong>portal users</strong> who log in on
        their behalf.
      </p>

      <p>
        Both endpoints live under <code>/api/b2b</code>, accept an array of
        records (max 5000 per request), validate it, enqueue a background job,
        and return <code>202</code> with a <code>job_id</code> you can poll.
        Import companies first — users reference companies by their{" "}
        <code>external_code</code>, which is resolved server-side.
      </p>

      <div className="not-prose mt-8 grid gap-3 sm:grid-cols-2">
        {CUSTOMERS_DOC_SECTIONS.map((section) => {
          const Icon = section.icon;
          const href = `/developers/customers/${section.slug}`;
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
