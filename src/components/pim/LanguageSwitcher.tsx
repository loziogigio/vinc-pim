/**
 * Language Switcher Component
 * Allows users to switch between enabled languages when editing products
 */

"use client";

import { useEffect } from "react";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  variant?: "tabs" | "dropdown" | "compact";
  className?: string;
  showLabel?: boolean;
}

export function LanguageSwitcher({
  variant = "tabs",
  className,
  showLabel = true,
}: LanguageSwitcherProps) {
  const {
    currentLanguage,
    languages,
    isLoading,
    showReferenceLanguage,
    setCurrentLanguage,
    setShowReferenceLanguage,
    fetchLanguages,
    getEnabledLanguages,
  } = useLanguageStore();

  // Fetch languages on mount
  useEffect(() => {
    if (languages.length === 0 && !isLoading) {
      fetchLanguages();
    }
  }, []);

  const enabledLanguages = getEnabledLanguages();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Globe className="h-4 w-4 animate-pulse" />
        <span>Loading languages...</span>
      </div>
    );
  }

  if (enabledLanguages.length === 0) {
    return null;
  }

  // Tabs variant - horizontal tabs layout
  if (variant === "tabs") {
    return (
      <div className={cn("space-y-2", className)}>
        {showLabel && (
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Language
          </label>
        )}
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {enabledLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setCurrentLanguage(lang.code)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors relative",
                "hover:text-blue-600 hover:bg-blue-50 rounded-t-md",
                currentLanguage === lang.code
                  ? "text-blue-600 bg-white border-t-2 border-x border-blue-600"
                  : "text-gray-600 bg-gray-50 border-t-2 border-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                {lang.flag && <span>{lang.flag}</span>}
                <span className="uppercase font-semibold">{lang.code}</span>
                <span className="hidden sm:inline text-gray-500">
                  {lang.nativeName}
                </span>
                {currentLanguage === lang.code && (
                  <Check className="h-3 w-3 text-blue-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Compact variant - small buttons
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <div className="flex items-center gap-2">
          {showLabel && (
            <>
              <Globe className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Editing Language:</span>
            </>
          )}
          <div className="flex items-center gap-1">
            {enabledLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setCurrentLanguage(lang.code)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded transition-colors",
                  currentLanguage === lang.code
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
                title={lang.nativeName}
              >
                {lang.flag && <span className="mr-1">{lang.flag}</span>}
                {lang.name}
              </button>
            ))}
          </div>
        </div>

        {/* Show reference language toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showReferenceLanguage}
            onChange={(e) => setShowReferenceLanguage(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show reference language</span>
        </label>
      </div>
    );
  }

  // Dropdown variant - select dropdown
  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Language
        </label>
      )}
      <select
        value={currentLanguage}
        onChange={(e) => setCurrentLanguage(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {enabledLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag ? `${lang.flag} ` : ""}
            {lang.nativeName} ({lang.code.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  );
}
