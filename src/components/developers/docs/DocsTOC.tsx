"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

interface DocsTOCProps {
  items: TocItem[];
}

/**
 * Right-hand table of contents.
 *
 * `items` is built at render time by {@link extractTocFromMdx} in the page
 * component (cheap heading regex on the MDX source). Active tracking uses
 * IntersectionObserver on the rendered headings.
 */
export function DocsTOC({ items }: DocsTOCProps) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: [0, 1] },
    );
    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-[calc(3.5rem+1px)] max-h-[calc(100vh-3.5rem-1px)] overflow-y-auto py-6 pl-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#9e9b99] dark:text-slate-400">
          On this page
        </p>
        <nav className="flex flex-col gap-1 border-l border-[#ebe9f1] dark:border-white/10">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={clsx(
                "-ml-px border-l-2 py-0.5 text-xs transition",
                item.depth === 3 ? "pl-6" : "pl-3",
                active === item.id
                  ? "border-[#009688] font-medium text-[#009688]"
                  : "border-transparent text-[#6e6b7b] hover:text-[#009688] dark:text-slate-400",
              )}
            >
              {item.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
