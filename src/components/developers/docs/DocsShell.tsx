import type { ReactNode } from "react";
import { DocsSidebar } from "./DocsSidebar";
import { DocsTOC, type TocItem } from "./DocsTOC";
import { DocsTopNav } from "./DocsTopNav";

interface DocsShellProps {
  children: ReactNode;
  toc?: TocItem[];
  showSidebar?: boolean;
}

export function DocsShell({ children, toc = [], showSidebar = true }: DocsShellProps) {
  return (
    <div className="min-h-screen bg-white text-[#5e5873] dark:bg-[#0f1419] dark:text-slate-200">
      <DocsTopNav />
      <div className="mx-auto max-w-[1400px] px-4 lg:px-6">
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: showSidebar
              ? "minmax(0, 14rem) minmax(0, 1fr) minmax(0, 14rem)"
              : "minmax(0, 1fr)",
          }}
        >
          {showSidebar && <DocsSidebar />}
          <main className="min-w-0 py-8">
            <article className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:text-[#5e5873] prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-10 prose-h2:text-lg prose-h2:font-semibold prose-h3:text-base prose-pre:rounded-[0.428rem] prose-pre:border prose-pre:border-[#ebe9f1] prose-pre:bg-[#f8f8f8] prose-pre:text-[#5e5873] dark:prose-headings:text-slate-100 dark:prose-pre:border-white/10 dark:prose-pre:bg-[#0b1014] dark:prose-pre:text-slate-200">
              {children}
            </article>
          </main>
          {showSidebar && <DocsTOC items={toc} />}
        </div>
      </div>
    </div>
  );
}
