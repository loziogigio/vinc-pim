import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";

export function DocsTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#ebe9f1] bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0f1419]/85">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 lg:px-6">
        <Link href="/developers" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[0.358rem] bg-[#009688] text-white">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[#5e5873] dark:text-slate-100">
              VINC Developers
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[#9e9b99] dark:text-slate-400">
              Public API docs
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-4 text-sm">
          <Link
            href="/developers/pim"
            className="text-[#6e6b7b] transition hover:text-[#009688] dark:text-slate-300"
          >
            PIM
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/b2b"
            className="inline-flex items-center gap-1 rounded-[0.358rem] border border-[#ebe9f1] bg-white px-3 py-1.5 text-xs font-semibold text-[#009688] transition hover:bg-[rgba(0,150,136,0.08)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            Open app
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
