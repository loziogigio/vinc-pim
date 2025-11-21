"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Tag as TagIcon } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useLanguageStore } from "@/lib/stores/languageStore";

type TagOption = {
  tag_id: string;
  name: string | Record<string, string>;
  slug: string;
  color?: string;
  is_active: boolean;
};

export type TagReference = {
  id: string;
  name: string | Record<string, string>;
  slug: string;
  color?: string;
};

/**
 * Helper function to extract text from multilingual objects
 * Uses default language first, then fallback chain
 * IMPORTANT: This function MUST always return a string, never an object
 */
function getMultilingualText(
  text: string | Record<string, string> | undefined | null | any,
  defaultLanguageCode: string = "it",
  fallback: string = ""
): string {
  // Handle null, undefined, or empty values
  if (!text) return fallback;

  // If already a string, return it
  if (typeof text === "string") return text;

  // If not an object, convert to string
  if (typeof text !== "object") return String(text);

  // Try to extract string from multilingual object
  try {
    const result = text[defaultLanguageCode] || text.en || Object.values(text)[0];

    // Ensure result is a string
    if (typeof result === "string" && result) return result;
    if (result) return String(result);

    return fallback;
  } catch (error) {
    console.error("Error extracting multilingual text:", error, text);
    return fallback;
  }
}

type Props = {
  value: TagReference[];
  onChange: (tags: TagReference[]) => void;
  disabled?: boolean;
};

export function TagSelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Language store for getting default language from database
  const { languages, fetchLanguages } = useLanguageStore();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";
  const [tags, setTags] = useState<TagOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLanguages();
    fetchTags();
  }, []);

  async function fetchTags() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("include_inactive", "true");
      params.set("sort_by", "display_order");
      params.set("sort_order", "asc");
      params.set("limit", "200");

      const res = await fetch(`/api/b2b/pim/tags?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleTag(tag: TagOption) {
    const exists = value.some((selected) => selected.id === tag.tag_id);
    if (exists) {
      onChange(value.filter((selected) => selected.id !== tag.tag_id));
    } else {
      onChange([
        ...value,
        {
          id: tag.tag_id,
          name: tag.name,
          slug: tag.slug,
          color: tag.color,
        },
      ]);
    }
  }

  function removeTag(tagId: string) {
    onChange(value.filter((tag) => tag.id !== tagId));
  }

  const filteredTags = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return tags.filter((tag) => {
      if (!normalizedQuery) return true;
      return (
        tag.name.toLowerCase().includes(normalizedQuery) ||
        tag.slug.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [tags, searchQuery]);

  const selectedIds = useMemo(() => new Set(value.map((tag) => tag.id)), [value]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <div
            key={tag.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border",
              tag.color ? "bg-white" : "bg-primary/10 text-primary border-primary/20",
              !tag.color && "text-primary"
            )}
            style={
              tag.color
                ? {
                    backgroundColor: `${tag.color}1a`,
                    borderColor: `${tag.color}33`,
                    color: tag.color,
                  }
                : undefined
            }
          >
            <TagIcon className="h-3 w-3" />
            <span>{getMultilingualText(tag.name, defaultLanguageCode, "")}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="p-0.5 rounded-full hover:bg-muted transition"
                title="Remove tag"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 rounded border border-dashed border-border px-4 py-2 text-sm hover:border-primary hover:bg-primary/5 transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        <TagIcon className="h-4 w-4" />
        <span>{value.length > 0 ? "Add more tags" : "Select tags"}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Select Tags</h2>
                <p className="text-sm text-muted-foreground">{value.length} selected</p>
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
                  placeholder="Search tags..."
                  className="w-full rounded border border-border bg-background px-10 py-2 text-sm focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading tags…</div>
              ) : filteredTags.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No tags found" : "No tags available"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedIds.has(tag.tag_id);
                    return (
                      <button
                        key={tag.tag_id}
                        type="button"
                        onClick={() => toggleTag(tag)}
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
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <TagIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{getMultilingualText(tag.name, defaultLanguageCode, "")}</span>
                              {tag.color && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                                  style={{
                                    backgroundColor: `${tag.color}1a`,
                                    borderColor: `${tag.color}33`,
                                    color: tag.color,
                                  }}
                                >
                                  <span
                                    className="inline-block h-2 w-2 rounded-full border border-border"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  {tag.color}
                                </span>
                              )}
                              {!tag.is_active && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{tag.slug}</div>
                            {tag.description && (
                              <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                {tag.description}
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
