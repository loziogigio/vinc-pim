"use client";

import type { ReactNode } from "react";
import type { Language } from "@/lib/stores/languageStore";

interface LanguageTabsProps {
  languages: Language[];
  active: string;
  onChange: (code: string) => void;
  /** Optional per-tab badge (e.g. item count). Hidden when 0/undefined. */
  countFor?: (code: string) => number | undefined;
  /** Optional leading "All" tab (value ""). */
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}

export function LanguageTabs({
  languages, active, onChange, countFor, includeAll, allLabel = "All", className,
}: LanguageTabsProps) {
  const tab = (key: string, label: ReactNode, count?: number) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key)}
      className={`-mb-px flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium transition ${
        active === key
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );

  return (
    <div className={className ?? "flex flex-wrap gap-1 border-b border-border"}>
      {includeAll && tab("", allLabel)}
      {languages.map((l) =>
        tab(
          l.code,
          <>
            {l.flag && <span className="mr-1">{l.flag}</span>}
            {l.nativeName || l.name}
          </>,
          countFor?.(l.code)
        )
      )}
    </div>
  );
}
