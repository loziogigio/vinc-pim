"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { matchApps } from "@/lib/utils/module-search";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ModuleSearchProps {
  tenant: string;
}

/**
 * Header command palette — live module matches under the search box.
 * ⌘K / Ctrl+K focuses, ↑/↓ move the active row, Enter navigates, Esc clears,
 * click-outside closes. Modules-only for now (the placeholder hints future scope).
 */
export function ModuleSearch({ tenant }: ModuleSearchProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => matchApps(query, (app) => t(`apps.${app.id}.name`)),
    [query, t]
  );

  const hasQuery = query.trim() !== "";
  const showPanel = isOpen && hasQuery;

  // Reset the active row whenever the match set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // ⌘K / Ctrl+K focuses the input from anywhere.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click-outside closes (same pattern as AppLauncherDropdown).
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (showPanel) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPanel]);

  function navigateTo(href: string) {
    router.push(`/${tenant}${href}`);
    setQuery("");
    setIsOpen(false);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      setIsOpen(false);
      return;
    }
    if (!matches.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = matches[activeIndex] ?? matches[0];
      if (target) navigateTo(target.href);
    }
  }

  return (
    <div ref={containerRef} className="relative hidden md:ml-4 md:flex md:flex-1">
      <label className="bd-line flex w-full items-center gap-2 rounded-xl border bg-[var(--vinc-surface)] px-3 py-2 transition focus-within:border-[var(--vinc-accent)]">
        <Search className="c-ink-40 h-4 w-4" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={t("header.searchPlaceholder")}
          aria-label={t("header.search")}
          className="vinc-search c-ink w-full text-[0.86rem] placeholder:text-[color:color-mix(in_oklab,var(--vinc-ink)_40%,transparent)]"
        />
        <span className="mono bd-line c-ink-25 hidden rounded border px-1.5 py-0.5 text-[0.62rem] lg:inline">⌘K</span>
      </label>

      {showPanel && (
        <div className="bd-line absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-[var(--vinc-surface)] shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          {matches.length > 0 ? (
            <ul className="max-h-[360px] overflow-y-auto overscroll-contain p-1.5">
              {matches.map((app, index) => (
                <li key={app.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateTo(app.href)}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[color:color-mix(in_oklab,var(--vinc-accent)_10%,transparent)]"
                    style={
                      index === activeIndex
                        ? { background: "color-mix(in oklab, var(--vinc-accent) 12%, transparent)" }
                        : undefined
                    }
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${app.color} text-white`}>
                      <app.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="c-ink block truncate text-[0.84rem] font-semibold leading-tight">
                        {t(`apps.${app.id}.name`)}
                      </span>
                      <span className="c-ink-45 block truncate text-[0.72rem] leading-tight">
                        {app.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="c-ink-45 px-4 py-6 text-center text-[0.82rem]">
              {t("header.noModulesFound")}
            </div>
          )}

          <div className="bd-line border-t">
            <Link
              href={`/${tenant}/b2b/moduli`}
              onClick={() => {
                setQuery("");
                setIsOpen(false);
              }}
              className="hover-accent c-ink-60 flex items-center justify-center gap-1.5 px-4 py-2.5 text-[0.78rem] font-medium transition-colors"
            >
              {t("header.openModuleCenter")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
