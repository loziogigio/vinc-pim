/**
 * Language Status Badge Component
 * Compact badge showing available/missing translations for a product
 * Perfect for product lists and tables
 */

"use client";

import { useLanguageStore } from "@/lib/stores/languageStore";
import { Check, AlertCircle, X, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultilingualText = Record<string, string>;

interface LanguageStatusBadgeProps {
  // Provide either product data or language status directly
  name?: MultilingualText;
  description?: MultilingualText;
  availableLanguages?: string[]; // Array of language codes that are available

  variant?: "minimal" | "detailed" | "flags";
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

export function LanguageStatusBadge({
  name,
  description,
  availableLanguages,
  variant = "minimal",
  size = "sm",
  className,
  showLabel = false,
}: LanguageStatusBadgeProps) {
  const { getEnabledLanguages } = useLanguageStore();

  const enabledLanguages = getEnabledLanguages();

  // Determine which languages have content
  const getLanguageStatus = (langCode: string): boolean => {
    // If availableLanguages is provided, use that
    if (availableLanguages) {
      return availableLanguages.includes(langCode);
    }

    // Otherwise check name and description
    const hasName = name?.[langCode] && name[langCode].trim().length > 0;
    const hasDescription = description?.[langCode] && description[langCode].trim().length > 0;

    return hasName || hasDescription;
  };

  const languageStatuses = enabledLanguages.map((lang) => ({
    language: lang,
    isAvailable: getLanguageStatus(lang.code),
  }));

  const availableCount = languageStatuses.filter((s) => s.isAvailable).length;
  const totalCount = languageStatuses.length;
  const coveragePercentage = totalCount > 0 ? Math.round((availableCount / totalCount) * 100) : 0;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // Minimal variant - just a count with color indicator
  if (variant === "minimal") {
    return (
      <div className={cn("inline-flex items-center gap-1.5", sizeClasses[size], className)}>
        {showLabel && <Languages className="h-3 w-3 text-gray-500" />}
        <span
          className={cn(
            "font-semibold px-2 py-0.5 rounded",
            coveragePercentage === 100
              ? "bg-green-100 text-green-700"
              : coveragePercentage >= 50
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"
          )}
        >
          {availableCount}/{totalCount}
        </span>
      </div>
    );
  }

  // Flags variant - show language flags with status
  if (variant === "flags") {
    return (
      <div className={cn("inline-flex items-center gap-1", sizeClasses[size], className)}>
        {showLabel && (
          <span className="text-gray-500 mr-1 text-xs">
            <Languages className="h-3 w-3" />
          </span>
        )}
        {languageStatuses.map(({ language, isAvailable }) => (
          <span
            key={language.code}
            className={cn(
              "inline-flex items-center px-1 py-0.5 rounded border",
              isAvailable
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200 opacity-50"
            )}
            title={`${language.nativeName} (${language.code.toUpperCase()}): ${
              isAvailable ? "Available" : "Missing"
            }`}
          >
            {language.flag ? (
              <span className="text-sm">{language.flag}</span>
            ) : (
              <span className="text-xs font-bold uppercase">{language.code}</span>
            )}
            {isAvailable ? (
              <Check className="h-2 w-2 text-green-600 ml-0.5" />
            ) : (
              <X className="h-2 w-2 text-gray-400 ml-0.5" />
            )}
          </span>
        ))}
      </div>
    );
  }

  // Detailed variant - show all languages with status icons
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1", sizeClasses[size], className)}>
      {showLabel && (
        <span className="text-gray-500 text-xs font-medium mr-1">Languages:</span>
      )}
      {languageStatuses.map(({ language, isAvailable }) => (
        <span
          key={language.code}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold uppercase",
            isAvailable
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-gray-100 text-gray-400 border border-gray-200"
          )}
          title={`${language.nativeName}: ${isAvailable ? "Available" : "Missing"}`}
        >
          {language.flag && <span>{language.flag}</span>}
          <span>{language.code}</span>
          {isAvailable ? (
            <Check className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Utility function to get language coverage percentage
 * Can be used for sorting products by translation completeness
 */
export function getLanguageCoverage(
  name?: MultilingualText,
  description?: MultilingualText,
  availableLanguages?: string[]
): number {
  if (availableLanguages) {
    return availableLanguages.length;
  }

  const languages = new Set<string>();

  if (name) {
    Object.keys(name).forEach((lang) => {
      if (name[lang] && name[lang].trim().length > 0) {
        languages.add(lang);
      }
    });
  }

  if (description) {
    Object.keys(description).forEach((lang) => {
      if (description[lang] && description[lang].trim().length > 0) {
        languages.add(lang);
      }
    });
  }

  return languages.size;
}
