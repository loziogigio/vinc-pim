"use client";

import { useRef } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, Moon, Sun, ShoppingCart, ChevronLeft, ChevronRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMockCategories } from "@/lib/data/mockCatalog";
import { useTheme } from "@/hooks/useTheme";

const categories = getMockCategories();

export const SiteHeader = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isDark, toggle, initialized } = useTheme();
  const listRef = useRef<HTMLDivElement | null>(null);
  const isAdminRoute = pathname?.startsWith("/admin");
  const isB2BRoute = pathname?.startsWith("/b2b") || pathname === "/";
  const isEmbeddedPreview = pathname === "/preview" && searchParams?.get("embed") === "true";
  if (isAdminRoute || isB2BRoute || isEmbeddedPreview) {
    return null;
  }

  const scrollBy = (delta: number) => {
    listRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <>
      {/* Sticky Top Bar - Always visible when scrolling */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3 md:px-6">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <Menu />
          </Button>
          <div className="flex items-center gap-2">
            <Store className="text-primary" />
            <span className="text-lg font-semibold">{t("components.siteHeader.storeName")}</span>
          </div>
          <div className="hidden flex-1 items-center gap-2 md:flex">
            <div className="relative w-full">
              <Input placeholder={t("components.siteHeader.searchPlaceholder")} className="rounded-xl pl-9" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={toggle}
              aria-pressed={isDark}
              disabled={!initialized}
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun /> : <Moon />}
            </Button>
            <Button variant="default" size="icon" className="rounded-xl">
              <ShoppingCart />
            </Button>
          </div>
        </div>
      </header>

      {/* Category Navigation - Scrolls with page */}
      <div className="border-b bg-background">
        <div className="relative mx-auto max-w-screen-xl">
          <button
            aria-label="Scroll categories left"
            onClick={() => scrollBy(-240)}
            className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 p-1 shadow-md backdrop-blur-sm md:flex"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Left fade gradient */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 hidden h-full w-16 bg-gradient-to-r from-background via-background/80 to-transparent md:block" />

          <div
            ref={listRef}
            className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2 scroll-smooth md:px-6"
          >
            {categories.map((category) => (
              <button
                key={category.id}
                className="flex shrink-0 items-center gap-2 rounded-xl border bg-card px-2 py-1.5 shadow-sm transition-colors hover:bg-accent"
              >
                <img src={category.image} alt={category.name} className="h-7 w-10 rounded-lg object-cover" />
                <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                  {category.name}
                </span>
              </button>
            ))}
          </div>

          {/* Right fade gradient */}
          <div className="pointer-events-none absolute right-0 top-0 z-10 hidden h-full w-16 bg-gradient-to-l from-background via-background/80 to-transparent md:block" />

          <button
            aria-label="Scroll categories right"
            onClick={() => scrollBy(240)}
            className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 p-1 shadow-md backdrop-blur-sm md:flex"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </>
  );
};
