/**
 * Language Completeness Indicator Component
 * Shows translation completeness for each language with visual progress indicators
 */

"use client";

import { useLanguageStore } from "@/lib/stores/languageStore";
import { Check, AlertCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type MultilingualText = Record<string, string>;

interface ProductData {
  name?: MultilingualText;
  slug?: MultilingualText;
  description?: MultilingualText;
  short_description?: MultilingualText;
  features?: Record<string, string[]>;
  specifications?: Record<string, any[]>;
  attributes?: Record<string, any[]>;
  category?: {
    name?: MultilingualText;
  };
  meta_title?: MultilingualText;
  meta_description?: MultilingualText;
}

interface LanguageCompletenessIndicatorProps {
  product: ProductData;
  variant?: "compact" | "detailed" | "card";
  className?: string;
  threshold?: number; // Minimum percentage for "complete" status (default: 80)
}

export function LanguageCompletenessIndicator({
  product,
  variant = "compact",
  className,
  threshold = 80,
}: LanguageCompletenessIndicatorProps) {
  const { getEnabledLanguages } = useLanguageStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const enabledLanguages = getEnabledLanguages();

  // Calculate completeness for a specific language
  const calculateCompleteness = (languageCode: string): number => {
    const checks = [
      !!product.name?.[languageCode],
      !!product.slug?.[languageCode],
      !!product.description?.[languageCode],
      !!product.short_description?.[languageCode],
      Array.isArray(product.features?.[languageCode]) && product.features[languageCode].length > 0,
      Array.isArray(product.specifications?.[languageCode]) && product.specifications[languageCode].length > 0,
      Array.isArray(product.attributes?.[languageCode]) && product.attributes[languageCode].length > 0,
      !!product.category?.name?.[languageCode],
      !!product.meta_title?.[languageCode],
      !!product.meta_description?.[languageCode],
    ];

    const completedChecks = checks.filter(Boolean).length;
    return Math.round((completedChecks / checks.length) * 100);
  };

  const getCompletenessStatus = (percentage: number) => {
    if (percentage >= threshold) return "complete";
    if (percentage >= 50) return "partial";
    return "incomplete";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
        return "text-green-600 bg-green-100 dark:bg-green-500/15 dark:text-green-300";
      case "partial":
        return "text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300";
      case "incomplete":
        return "text-red-600 bg-red-100 dark:bg-red-500/15 dark:text-red-300";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <Check className="h-3 w-3" />;
      case "partial":
        return <AlertCircle className="h-3 w-3" />;
      case "incomplete":
        return <X className="h-3 w-3" />;
      default:
        return null;
    }
  };

  if (enabledLanguages.length === 0) {
    return null;
  }

  const languageStats = enabledLanguages.map((lang) => {
    const percentage = calculateCompleteness(lang.code);
    const status = getCompletenessStatus(percentage);
    return { language: lang, percentage, status };
  });

  // Compact variant - just badges
  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {languageStats.map(({ language, percentage, status }) => (
          <div
            key={language.code}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold",
              getStatusColor(status)
            )}
            title={`${language.nativeName}: ${percentage}% complete`}
          >
            {language.flag && <span>{language.flag}</span>}
            <span className="uppercase">{language.code}</span>
            {getStatusIcon(status)}
          </div>
        ))}
      </div>
    );
  }

  // Detailed variant - progress bars
  if (variant === "detailed") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Translation Status</h4>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                Hide <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show Details <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        </div>

        <div className="space-y-2">
          {languageStats.map(({ language, percentage, status }) => (
            <div key={language.code} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {language.flag && <span>{language.flag}</span>}
                  <span className="font-medium">{language.nativeName}</span>
                  <span className="text-muted-foreground uppercase">({language.code})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={cn("font-semibold", percentage >= threshold ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                    {percentage}%
                  </span>
                  {getStatusIcon(status)}
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    percentage >= threshold
                      ? "bg-green-500"
                      : percentage >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {isExpanded && (
                <div className="ml-4 mt-1 text-xs text-muted-foreground">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <div className="flex items-center gap-1">
                      {product.name?.[language.code] ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span>Name</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {product.description?.[language.code] ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span>Description</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {product.features?.[language.code]?.length > 0 ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span>Features</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {product.specifications?.[language.code]?.length > 0 ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span>Specifications</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {product.meta_title?.[language.code] ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span>SEO Title</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {product.meta_description?.[language.code] ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40" />
                      )}
                      <span>SEO Description</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card variant - standalone card with summary
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4 space-y-3", className)}>
      <h4 className="text-sm font-medium text-foreground">Translation Completeness</h4>

      <div className="grid grid-cols-2 gap-3">
        {languageStats.map(({ language, percentage, status }) => (
          <div
            key={language.code}
            className="flex items-center justify-between p-2 bg-muted rounded border border-border"
          >
            <div className="flex items-center gap-2">
              {language.flag && <span className="text-lg">{language.flag}</span>}
              <div>
                <div className="text-xs font-semibold text-foreground uppercase">
                  {language.code}
                </div>
                <div className="text-xs text-muted-foreground">{language.nativeName}</div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className={cn("text-sm font-bold", percentage >= threshold ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                {percentage}%
              </div>
              <div className={cn("text-xs px-1.5 py-0.5 rounded mt-1", getStatusColor(status))}>
                {status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
