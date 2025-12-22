"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, BookA } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useLanguageStore } from "@/lib/stores/languageStore";

type SynonymDictionary = {
  dictionary_id: string;
  key: string;
  description?: string;
  terms: string[];
  locale: string;
  is_active: boolean;
  product_count: number;
};

export type SynonymDictionaryReference = {
  key: string;
  locale: string;
  dictionary_id?: string;
};

type Props = {
  value: string[]; // Array of dictionary keys
  onChange: (keys: string[]) => void;
  locale?: string; // Filter by locale
  disabled?: boolean;
};

export function SynonymDictionarySelector({ value, onChange, locale, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dictionaries, setDictionaries] = useState<SynonymDictionary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Language store
  const { languages, currentLanguage } = useLanguageStore();
  const effectiveLocale = locale || currentLanguage || "it";

  useEffect(() => {
    if (isOpen) {
      fetchDictionaries();
    }
  }, [isOpen, effectiveLocale]);

  async function fetchDictionaries() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("locale", effectiveLocale);
      params.set("limit", "200");
      params.set("sort_by", "key");
      params.set("sort_order", "asc");

      const res = await fetch(`/api/b2b/pim/synonym-dictionaries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDictionaries(data.dictionaries || []);
      }
    } catch (error) {
      console.error("Failed to fetch synonym dictionaries:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleDictionary(dict: SynonymDictionary) {
    const exists = value.includes(dict.key);
    if (exists) {
      onChange(value.filter((key) => key !== dict.key));
    } else {
      onChange([...value, dict.key]);
    }
  }

  function removeKey(key: string) {
    onChange(value.filter((k) => k !== key));
  }

  const filteredDictionaries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return dictionaries.filter((dict) => {
      if (!normalizedQuery) return true;
      return (
        dict.key.toLowerCase().includes(normalizedQuery) ||
        dict.description?.toLowerCase().includes(normalizedQuery) ||
        dict.terms.some((term) => term.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [dictionaries, searchQuery]);

  const selectedKeys = useMemo(() => new Set(value), [value]);

  // Get dictionary info for selected keys
  const selectedDictionaries = useMemo(() => {
    return value.map((key) => {
      const dict = dictionaries.find((d) => d.key === key);
      return {
        key,
        terms: dict?.terms || [],
        description: dict?.description,
      };
    });
  }, [value, dictionaries]);

  return (
    <div className="space-y-3">
      {/* Selected dictionaries */}
      <div className="flex flex-wrap gap-2">
        {value.map((key) => {
          const dict = dictionaries.find((d) => d.key === key);
          return (
            <div
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 text-sm font-medium"
            >
              <BookA className="h-3 w-3" />
              <span>{key}</span>
              {dict && (
                <span className="text-xs text-blue-500">
                  ({dict.terms.length} terms)
                </span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeKey(key)}
                  className="p-0.5 rounded-full hover:bg-blue-100 transition"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 rounded border border-dashed border-border px-4 py-2 text-sm hover:border-primary hover:bg-primary/5 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BookA className="h-4 w-4" />
        <span>{value.length > 0 ? "Add more synonyms" : "Select synonym dictionaries"}</span>
      </button>

      {/* Selection modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Select Synonym Dictionaries</h2>
                <p className="text-sm text-muted-foreground">
                  {value.length} selected • Locale: {effectiveLocale.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-border px-6 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by key, description, or terms..."
                  className="w-full rounded border border-border bg-background px-10 py-2 text-sm focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading dictionaries…</div>
              ) : filteredDictionaries.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No dictionaries found" : "No dictionaries available for this locale"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDictionaries.map((dict) => {
                    const isSelected = selectedKeys.has(dict.key);
                    return (
                      <button
                        key={dict.dictionary_id}
                        type="button"
                        onClick={() => toggleDictionary(dict)}
                        className={cn(
                          "w-full rounded border px-4 py-3 text-left transition",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary hover:bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                            <BookA className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{dict.key}</span>
                              <span className="text-xs text-muted-foreground">
                                ({dict.terms.length} terms)
                              </span>
                              {!dict.is_active && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {dict.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {dict.description}
                              </div>
                            )}
                            {dict.terms.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {dict.terms.slice(0, 5).map((term) => (
                                  <span
                                    key={term}
                                    className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                  >
                                    {term}
                                  </span>
                                ))}
                                {dict.terms.length > 5 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{dict.terms.length - 5} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className="rounded border border-border px-4 py-2 text-sm hover:bg-muted transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
