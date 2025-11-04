"use client";

import { useState, useEffect } from "react";
import { Search, X, FolderTree, ChevronRight } from "lucide-react";

type Category = {
  category_id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  level: number;
  path: string;
  children?: Category[];
};

type SelectedCategory = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  value?: SelectedCategory;
  onChange: (category: SelectedCategory | null) => void;
  disabled?: boolean;
};

export function CategorySelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
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
    ? flatCategories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories;

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-foreground mb-1">
        Category
      </label>

      {/* Selected Value Display */}
      {value ? (
        <div className="flex items-center justify-between p-3 rounded border border-border bg-background">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {/* Find the selected category to get its full path */}
                {(() => {
                  const selectedCat = flatCategories.find(c => c.category_id === value.id);
                  if (selectedCat && selectedCat.path) {
                    return selectedCat.path;
                  }
                  return value.name;
                })()}
              </p>
              <p className="text-xs text-muted-foreground">{value.slug}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            disabled={disabled}
            className="p-1 rounded hover:bg-muted transition disabled:opacity-50"
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
                          <p className="font-medium text-foreground">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">{cat.path}</p>
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
                          <span className="flex-1 text-sm font-medium text-foreground">{cat.name}</span>
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
}: {
  categories: Category[];
  onSelect: (category: Category) => void;
  level?: number;
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
                  <span className="text-sm font-medium text-foreground">{category.name}</span>
                </div>
              </button>
            </div>

            {hasChildren && isExpanded && (
              <CategoryTree
                categories={category.children!}
                onSelect={onSelect}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
