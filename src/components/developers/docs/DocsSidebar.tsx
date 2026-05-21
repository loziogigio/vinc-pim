"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { PIM_DOC_SECTIONS } from "@content/developers/pim/_sections";
import { CUSTOMERS_DOC_SECTIONS } from "@content/developers/customers/_sections";

interface SidebarSection {
  slug: string;
  title: string;
  icon: LucideIcon;
}

interface Surface {
  /** Base path, e.g. /developers/pim — also used to detect the active surface. */
  basePath: string;
  /** Heading shown above the section list. */
  label: string;
  /** Label for the index link at the top of the list. */
  indexLabel: string;
  sections: SidebarSection[];
}

const SURFACES: Surface[] = [
  {
    basePath: "/developers/pim",
    label: "PIM",
    indexLabel: "Introduction",
    sections: PIM_DOC_SECTIONS,
  },
  {
    basePath: "/developers/customers",
    label: "Customers & Users",
    indexLabel: "Introduction",
    sections: CUSTOMERS_DOC_SECTIONS,
  },
];

export function DocsSidebar() {
  const pathname = usePathname() ?? "";
  const surface =
    SURFACES.find((s) => pathname.startsWith(s.basePath)) ?? SURFACES[0];
  const indexActive = pathname === surface.basePath;

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[calc(3.5rem+1px)] max-h-[calc(100vh-3.5rem-1px)] overflow-y-auto py-6 pr-4">
        <h2 className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-[#9e9b99] dark:text-slate-400">
          {surface.label}
        </h2>
        <nav className="flex flex-col gap-0.5">
          <Link
            href={surface.basePath}
            className={clsx(
              "flex items-center gap-2 rounded-[0.358rem] px-3 py-1.5 text-sm font-medium transition",
              indexActive
                ? "bg-[rgba(0,150,136,0.12)] text-[#009688]"
                : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688] dark:text-slate-300 dark:hover:bg-white/5",
            )}
          >
            {surface.indexLabel}
          </Link>
          {surface.sections.map((section) => {
            const href = `${surface.basePath}/${section.slug}`;
            const isActive = pathname === href;
            const Icon = section.icon;
            return (
              <Link
                key={section.slug}
                href={href}
                className={clsx(
                  "flex items-center gap-2 rounded-[0.358rem] px-3 py-1.5 text-sm transition",
                  isActive
                    ? "bg-[rgba(0,150,136,0.12)] font-medium text-[#009688]"
                    : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688] dark:text-slate-300 dark:hover:bg-white/5",
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                <span>{section.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
