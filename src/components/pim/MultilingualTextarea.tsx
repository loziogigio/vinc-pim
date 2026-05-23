/**
 * Multilingual Textarea Component
 * Textarea field that supports multiple languages with tab interface
 */

"use client";

import { useState, useEffect } from "react";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { AlertCircle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultilingualText = Record<string, string>;

interface MultilingualTextareaProps {
  label: string;
  value: MultilingualText;
  onChange: (value: MultilingualText) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
  rows?: number;
  maxLength?: number;
  showCharCount?: boolean;
  showReference?: boolean; // Show reference language box
  variant?: "tabs" | "reference"; // tabs = old style, reference = new style with reference box
}

export function MultilingualTextarea({
  label,
  value = {},
  onChange,
  placeholder = "",
  required = false,
  className,
  error,
  helpText,
  rows = 4,
  maxLength,
  showCharCount = true,
  showReference: showReferenceProp = true,
  variant = "reference",
}: MultilingualTextareaProps) {
  const { currentLanguage, languages, getEnabledLanguages, showReferenceLanguage } = useLanguageStore();
  const [activeTab, setActiveTab] = useState<string>(currentLanguage || "it");

  const enabledLanguages = getEnabledLanguages();
  const defaultLang = languages.find(l => l.isDefault) || languages.find(l => l.code === "it");
  const currentLang = languages.find(l => l.code === currentLanguage) || defaultLang;

  // Use global state if available, fallback to prop
  const showReference = showReferenceLanguage && showReferenceProp;

  // Set initial active tab to first enabled language
  useEffect(() => {
    if (enabledLanguages.length > 0 && !enabledLanguages.find(l => l.code === activeTab)) {
      setActiveTab(enabledLanguages[0].code);
    }
  }, [enabledLanguages]);

  const handleChange = (languageCode: string, text: string) => {
    const newValue = { ...value, [languageCode]: text };
    onChange(newValue);
  };

  const getLanguageStatus = (languageCode: string) => {
    const text = value[languageCode];
    return text && text.trim().length > 0;
  };

  const getCurrentCharCount = () => {
    return value[activeTab]?.length || 0;
  };

  if (enabledLanguages.length === 0) {
    return (
      <div className={cn("space-y-2", className)}>
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="text-sm text-muted-foreground">No languages enabled</div>
      </div>
    );
  }

  // Reference variant - shows reference language box + editable translation box
  if (variant === "reference") {
    const isEditingDefaultLang = currentLanguage === defaultLang?.code;
    const referenceText = defaultLang ? value[defaultLang.code] : "";

    return (
      <div className={cn("space-y-2", className)}>
        {/* Label */}
        <label className="block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {/* If editing non-default language and showReference is true, show reference box */}
        {!isEditingDefaultLang && showReference && referenceText && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-2 dark:bg-blue-500/15 dark:border-blue-500/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                {defaultLang?.flag} {defaultLang?.nativeName} (Main Language)
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400">Reference</span>
            </div>
            <div className="text-foreground text-sm whitespace-pre-wrap">{referenceText}</div>
          </div>
        )}

        {/* Editable textarea */}
        <div className="border border-border rounded p-3 bg-background">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {currentLang?.flag} {currentLang?.nativeName}
              {!isEditingDefaultLang && " (Translating)"}
            </span>
          </div>
          <textarea
            value={value[currentLanguage] || ""}
            onChange={(e) => handleChange(currentLanguage, e.target.value)}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            className="w-full border-0 p-0 focus:ring-0 resize-y"
          />
        </div>

        {/* Help Text or Error */}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
        {!error && helpText && (
          <p className="text-xs text-muted-foreground">{helpText}</p>
        )}
      </div>
    );
  }

  // Tabs variant - original implementation
  const charCount = getCurrentCharCount();
  const isNearLimit = maxLength && charCount > maxLength * 0.9;
  const isOverLimit = maxLength && charCount > maxLength;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Language Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {enabledLanguages.map((lang) => {
          const hasValue = getLanguageStatus(lang.code);
          const isActive = activeTab === lang.code;

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setActiveTab(lang.code)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all relative",
                "rounded-t-md flex items-center gap-1.5",
                isActive
                  ? "text-blue-600 bg-card border-t-2 border-x border-blue-600 -mb-[1px] dark:text-blue-400 dark:border-blue-400"
                  : "text-muted-foreground bg-muted hover:bg-accent hover:text-accent-foreground border-t-2 border-transparent"
              )}
            >
              {lang.flag && <span className="text-sm">{lang.flag}</span>}
              <span className="uppercase font-bold">{lang.code}</span>

              {/* Completion indicator */}
              {hasValue ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : required ? (
                <AlertCircle className="h-3 w-3 text-amber-500" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/40" />
              )}
            </button>
          );
        })}
      </div>

      {/* Textarea Field */}
      <div className="relative">
        <textarea
          value={value[activeTab] || ""}
          onChange={(e) => handleChange(activeTab, e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={cn(
            "w-full px-3 py-2 border rounded-md text-sm resize-y bg-background",
            "focus:outline-none focus:ring-2",
            error
              ? "border-red-300 focus:ring-red-500 dark:border-red-500/60"
              : "border-border focus:ring-ring"
          )}
        />

        {/* Current language indicator */}
        <div className="absolute right-3 top-3 pointer-events-none">
          <span className="text-xs font-semibold text-muted-foreground uppercase bg-background px-1">
            {activeTab}
          </span>
        </div>
      </div>

      {/* Character Count */}
      {showCharCount && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Translations:</span>
            {enabledLanguages.map((lang) => {
              const hasValue = getLanguageStatus(lang.code);
              return (
                <span
                  key={lang.code}
                  className={cn(
                    "px-1.5 py-0.5 rounded font-semibold uppercase",
                    hasValue
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {lang.code}
                </span>
              );
            })}
          </div>

          {maxLength && (
            <span
              className={cn(
                "font-medium",
                isOverLimit
                  ? "text-red-600"
                  : isNearLimit
                  ? "text-amber-600"
                  : "text-muted-foreground"
              )}
            >
              {charCount} / {maxLength}
            </span>
          )}
        </div>
      )}

      {/* Help Text or Error */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      {!error && helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
