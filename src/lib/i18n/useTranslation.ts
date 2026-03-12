/**
 * React hook for UI translations.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   <h1>{t("login.welcome")}</h1>
 */

"use client";

import { useMemo } from "react";
import { useUILanguageStore } from "@/lib/stores/uiLanguageStore";
import { createT } from "@/lib/i18n";
import type { UILocale } from "@/lib/i18n";

export function useTranslation() {
  const locale = useUILanguageStore((s) => s.locale);
  const setLocale = useUILanguageStore((s) => s.setLocale);

  const t = useMemo(() => createT(locale), [locale]);

  return { t, locale, setLocale } as const;
}

export type { UILocale };
