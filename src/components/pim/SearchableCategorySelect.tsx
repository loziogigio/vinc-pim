"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export type CategoryRecord = {
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string | null;
  level: number;
  path: string[];
  display_order: number;
  is_active: boolean;
  hero_image?: {
    url: string;
    alt_text?: string;
    cdn_key?: string;
  };
  mobile_hero_image?: {
    url: string;
    alt_text?: string;
    cdn_key?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  product_count?: number;
  child_count?: number;
  channel_code?: string;
};

type FlattenedCategory = CategoryRecord & { _displayLevel?: number };

interface SearchableCategorySelectProps {
  categories: CategoryRecord[];
  value: string;
  onChange: (value: string) => void;
  excludeCategoryId?: string;
  /** Label for the empty option. Defaults to "None (Root Category)". */
  emptyLabel?: string;
}

function flattenTree(
  categories: CategoryRecord[],
  parentId: string | null = null,
  level = 0
): FlattenedCategory[] {
  const children = categories
    .filter((c) => (parentId === null ? !c.parent_id : c.parent_id === parentId))
    .sort((a, b) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });

  return children.flatMap((category) => {
    const hasChildren = categories.some((c) => c.parent_id === category.category_id);
    return [
      { ...category, _displayLevel: level },
      ...(hasChildren ? flattenTree(categories, category.category_id, level + 1) : []),
    ];
  });
}

export function SearchableCategorySelect({
  categories,
  value,
  onChange,
  excludeCategoryId,
  emptyLabel = "None (Root Category)",
}: SearchableCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableCategories = useMemo(
    () =>
      categories
        .filter((c) => {
          if (!c.is_active) return false;
          if (c.category_id === excludeCategoryId) return false;
          if (excludeCategoryId && c.path?.includes(excludeCategoryId)) return false;
          return true;
        })
        .sort((a, b) => {
          if (a.level !== b.level) return a.level - b.level;
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          return a.name.localeCompare(b.name);
        }),
    [categories, excludeCategoryId]
  );

  const flatCategories = useMemo(() => flattenTree(availableCategories), [availableCategories]);

  const filteredCategories = searchQuery
    ? flatCategories.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : flatCategories;

  const selectedCategory = value ? categories.find((c) => c.category_id === value) : null;

  function select(categoryId: string) {
    onChange(categoryId);
    setIsOpen(false);
    setSearchQuery("");
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-left focus:border-primary focus:outline-none flex items-center justify-between"
      >
        <span className={selectedCategory ? "text-foreground" : "text-muted-foreground"}>
          {selectedCategory ? selectedCategory.name : emptyLabel}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 border-b border-border sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-border rounded focus:border-primary focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => select("")}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition ${
                !value ? "bg-primary/10 text-primary font-medium" : ""
              }`}
            >
              {emptyLabel}
            </button>

            {filteredCategories.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No categories found</div>
            ) : (
              filteredCategories.map((category) => {
                const level = category._displayLevel || 0;
                return (
                  <button
                    key={category.category_id}
                    type="button"
                    onClick={() => select(category.category_id)}
                    className={`w-full py-2.5 px-4 text-left text-sm hover:bg-muted transition ${
                      value === category.category_id ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-1 flex-shrink-0" style={{ width: `${level * 24}px` }}>
                        {level > 0 && (
                          <>
                            {Array(level - 1)
                              .fill(0)
                              .map((_, i) => (
                                <span key={i} className="text-muted-foreground/40 text-xs w-6 text-center">
                                  │
                                </span>
                              ))}
                            <span className="text-muted-foreground/40 text-xs w-6">⌞</span>
                          </>
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground">{category.name}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
