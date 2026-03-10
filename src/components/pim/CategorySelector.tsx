"use client";

import { useState, useEffect } from "react";
import { Search, X, FolderTree, ChevronRight } from "lucide-react";
import { useLanguageStore } from "@/lib/stores/languageStore";

type Category = {
  category_id: string;
  name: string | Record<string, string>;
  slug: string;
  parent_id?: string | null;
  level: number;
  path: string[] | Record<string, string>;
  channel_code?: string;
  children?: Category[];
};

type SelectedCategory = {
  id?: string;
  category_id?: string;
  name: string | Record<string, string>;
  slug: string;
};

type Props = {
  value?: SelectedCategory;
  onChange: (category: SelectedCategory | null) => void;
  disabled?: boolean;
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

/**
 * Build a human-readable breadcrumb array from a category's path.
 * Uses the flat category list to resolve ancestor names.
 */
function buildBreadcrumb(
  cat: Category | undefined,
  flatCats: Category[],
  langCode: string
): string[] | null {
  if (!cat) return null;
  const catMap = new Map(flatCats.map(c => [c.category_id, c]));
  const crumbs: string[] = [];
  // path is an array of ancestor IDs (from root to parent)
  if (Array.isArray(cat.path)) {
    for (const ancestorId of cat.path) {
      const ancestor = catMap.get(ancestorId);
      if (ancestor) {
        crumbs.push(getMultilingualText(ancestor.name, langCode, ancestorId));
      }
    }
  }
  crumbs.push(getMultilingualText(cat.name, langCode, cat.category_id));
  return crumbs.length > 0 ? crumbs : null;
}

/**
 * Resolve channel code for a category (stored on root, inherited by children).
 */
function resolveChannel(
  cat: Category | undefined,
  flatCats: Category[]
): string | null {
  if (!cat) return null;
  if (cat.channel_code) return cat.channel_code;
  if (Array.isArray(cat.path) && cat.path.length > 0) {
    const rootId = cat.path[0];
    const root = flatCats.find(c => c.category_id === rootId);
    return root?.channel_code || null;
  }
  return null;
}

export function CategorySelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Language store for getting default language from database
  const { languages, fetchLanguages } = useLanguageStore();
  const defaultLanguage = languages.find(lang => lang.isDefault) || languages.find(lang => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  useEffect(() => {
    fetchLanguages();
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/categories?include_inactive=false");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        // Flatten for search
        setFlatCategories(flattenCategories(data.categories));
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function flattenCategories(cats: Category[]): Category[] {
    const flat: Category[] = [];
    function traverse(items: Category[]) {
      items.forEach((item) => {
        flat.push(item);
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      });
    }
    traverse(cats);
    return flat;
  }

  function selectCategory(category: Category) {
    onChange({
      id: category.category_id,
      category_id: category.category_id,
      name: category.name,
      slug: category.slug,
    });
    setIsOpen(false);
    setSearchQuery("");
  }

  function clearSelection() {
    onChange(null);
  }

  const filteredCategories = searchQuery
    ? flatCategories.filter((c) => {
        const name = getMultilingualText(c.name, defaultLanguageCode, "");
        const path = getMultilingualText(c.path, defaultLanguageCode, "");
        return (
          name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
          path.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
    : categories;

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-foreground mb-1">
        Category
      </label>

      {/* Selected Value Display */}
      {value ? (
        <div className="flex items-center justify-between p-3 rounded border border-border bg-background">
          <div className="flex items-center gap-2 min-w-0">
            <FolderTree className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              {(() => {
                const valueId = value.id || value.category_id;
                const selectedCat = flatCategories.find(c => c.category_id === valueId);
                const displayName = getMultilingualText(value.name, defaultLanguageCode, "");
                // Build breadcrumb from ancestor IDs
                const breadcrumb = buildBreadcrumb(selectedCat, flatCategories, defaultLanguageCode);
                // Resolve channel from the flat category list
                const channelCode = resolveChannel(selectedCat, flatCategories);
                return (
                  <>
                    {breadcrumb ? (
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                        {breadcrumb.map((seg, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                            <span className={i === breadcrumb.length - 1 ? "text-foreground" : "text-muted-foreground"}>{seg}</span>
                          </span>
                        ))}
                        {channelCode && (
                          <span className="inline-block ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">{channelCode}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-foreground">
                        {displayName || getMultilingualText(value.slug, defaultLanguageCode, "Category")}
                        {channelCode && (
                          <span className="inline-block ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">{channelCode}</span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{getMultilingualText(value.slug, defaultLanguageCode, "")}</p>
                  </>
                );
              })()}
            </div>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            disabled={disabled}
            className="p-1 rounded hover:bg-muted transition disabled:opacity-50 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          className="w-full flex items-center justify-between p-3 rounded border border-border bg-background hover:border-primary transition disabled:opacity-50 text-left"
        >
          <span className="text-sm text-muted-foreground">Select a category...</span>
          <FolderTree className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Dropdown Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-foreground">Select Category</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-muted transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-border bg-background focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-muted-foreground">Loading categories...</div>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-12">
                  <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No categories found" : "No categories available"}
                  </p>
                </div>
              ) : searchQuery ? (
                // Flat list for search results
                <div className="space-y-2">
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.category_id}
                      onClick={() => selectCategory(cat)}
                      className="w-full text-left p-4 rounded border border-border hover:border-primary hover:bg-primary/5 transition"
                    >
                      <div className="flex items-start gap-3">
                        <FolderTree className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{getMultilingualText(cat.name, defaultLanguageCode, "")}</p>
                          <p className="text-xs text-muted-foreground">{getMultilingualText(cat.path, defaultLanguageCode, "")}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                // Hierarchical list view with tree structure
                <div className="space-y-0.5">
                  {flatCategories.map((cat, index) => {
                    const nextCat = flatCategories[index + 1];
                    const isLastChild = !nextCat || nextCat.level <= cat.level;

                    return (
                      <button
                        key={cat.category_id}
                        onClick={() => selectCategory(cat)}
                        className="w-full text-left py-2.5 px-4 hover:bg-muted transition"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex items-center gap-1 flex-shrink-0" style={{ width: `${cat.level * 24}px` }}>
                            {cat.level > 0 && (
                              <>
                                {Array(cat.level - 1).fill(0).map((_, i) => (
                                  <span key={i} className="text-muted-foreground/40 text-xs w-6 text-center">│</span>
                                ))}
                                <span className="text-muted-foreground/40 text-xs w-6">⌞</span>
                              </>
                            )}
                          </div>
                          <span className="flex-1 text-sm font-medium text-foreground">{getMultilingualText(cat.name, defaultLanguageCode, "")}</span>
                          {(() => {
                            const ch = resolveChannel(cat, flatCategories);
                            return ch ? <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">{ch}</span> : null;
                          })()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Recursive category tree component
function CategoryTree({
  categories,
  onSelect,
  level = 0,
  defaultLanguageCode = "it",
}: {
  categories: Category[];
  onSelect: (category: Category) => void;
  level?: number;
  defaultLanguageCode?: string;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(categoryId: string) {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedIds(newExpanded);
  }

  return (
    <div className="space-y-1">
      {categories.map((category) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedIds.has(category.category_id);

        return (
          <div key={category.category_id}>
            <div
              className="flex items-center gap-2 rounded hover:bg-muted transition"
              style={{ paddingLeft: `${level * 20}px` }}
            >
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(category.category_id)}
                  className="p-1 rounded hover:bg-muted-foreground/10"
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <div className="w-6" />
              )}
              <button
                onClick={() => onSelect(category)}
                className="flex-1 text-left py-2 px-3 rounded hover:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{getMultilingualText(category.name, defaultLanguageCode, "")}</span>
                </div>
              </button>
            </div>

            {hasChildren && isExpanded && (
              <CategoryTree
                categories={category.children!}
                onSelect={onSelect}
                level={level + 1}
                defaultLanguageCode={defaultLanguageCode}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
