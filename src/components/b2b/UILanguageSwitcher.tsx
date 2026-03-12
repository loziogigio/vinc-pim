"use client";

import { useState, useRef, useEffect } from "react";
import { Languages } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { UI_LOCALES } from "@/lib/i18n";
import type { UILocale } from "@/lib/i18n";

export function UILanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { locale, setLocale } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLocale = UI_LOCALES.find((l) => l.code === locale) || UI_LOCALES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (code: UILocale) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-[38px] items-center gap-1.5 rounded-[5px] border-0 bg-transparent px-2 text-[#6e6b7b] transition hover:bg-[#fafafc] hover:text-[#009688]"
        aria-label="Change language"
        title="Change language"
      >
        <Languages className="h-[1rem] w-[1rem]" />
        <span className="text-xs font-medium uppercase">{currentLocale.code}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-[180px] rounded-lg border border-[#dadce0] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
          {UI_LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => handleSelect(l.code)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                l.code === locale
                  ? "bg-[#009688]/10 text-[#009688] font-medium"
                  : "text-[#5e5873] hover:bg-[#f8f8f8]"
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.nativeName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
