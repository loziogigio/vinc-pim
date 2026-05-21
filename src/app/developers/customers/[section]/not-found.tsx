import Link from "next/link";
import { DocsTopNav } from "@/components/developers/docs/DocsTopNav";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white text-[#5e5873] dark:bg-[#0f1419] dark:text-slate-200">
      <DocsTopNav />
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#ea5455]">
          404
        </p>
        <h1 className="mb-3 text-2xl font-semibold">Section not found</h1>
        <p className="mb-6 text-sm text-[#6e6b7b] dark:text-slate-400">
          That Customers &amp; Users docs section doesn&apos;t exist. Head back
          to the index to find what you&apos;re looking for.
        </p>
        <Link
          href="/developers/customers"
          className="inline-flex items-center gap-1 rounded-[0.358rem] bg-[#009688] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00796b]"
        >
          Back to Customers &amp; Users docs
        </Link>
      </div>
    </div>
  );
}
