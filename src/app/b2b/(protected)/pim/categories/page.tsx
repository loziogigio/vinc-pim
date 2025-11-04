"use client";

import { useState, useEffect, useRef } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Package,
  Search,
  ChevronsDown,
  ChevronsUp,
  GripVertical,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Category = {
  _id: string;
  category_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  level: number;
  path: string[];
  hero_image?: {
    url: string;
    alt_text?: string;
    cdn_key?: string;
  };
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  display_order: number;
  is_active: boolean;
  product_count: number;
  child_count?: number;
  created_at: string;
  updated_at: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/categories?include_inactive=true");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleExpand(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function expandAll() {
    const allIds = new Set(categories.map((c) => c.category_id));
    setExpandedCategories(allIds);
  }

  function collapseAll() {
    setExpandedCategories(new Set());
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeCategory = categories.find((c) => c.category_id === active.id);
    const overCategory = categories.find((c) => c.category_id === over.id);

    if (!activeCategory || !overCategory) {
      return;
    }

    // Only allow reordering within the same parent
    if (activeCategory.parent_id !== overCategory.parent_id) {
      toast.error("Can only reorder categories within the same level");
      return;
    }

    // Get siblings at the same level
    const siblings = categories.filter((c) => c.parent_id === activeCategory.parent_id);
    const oldIndex = siblings.findIndex((c) => c.category_id === active.id);
    const newIndex = siblings.findIndex((c) => c.category_id === over.id);

    const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex);

    // Update display_order for all reordered siblings
    const updates = reorderedSiblings.map((cat, index) => ({
      category_id: cat.category_id,
      display_order: index,
    }));

    // Optimistically update UI
    setCategories((prev) => {
      const updated = [...prev];
      updates.forEach((update) => {
        const cat = updated.find((c) => c.category_id === update.category_id);
        if (cat) {
          cat.display_order = update.display_order;
        }
      });
      return updated;
    });

    // Persist to API
    try {
      const res = await fetch("/api/b2b/pim/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        throw new Error("Failed to reorder");
      }

      toast.success("Categories reordered successfully");
    } catch (error) {
      console.error("Error reordering categories:", error);
      toast.error("Failed to reorder categories");
      fetchCategories(); // Revert on error
    }
  }

  async function handleDelete(category: Category) {
    if (category.product_count > 0) {
      toast.error(
        `Cannot delete category with ${category.product_count} products. Please reassign them first.`
      );
      return;
    }

    const childCount = categories.filter((c) => c.parent_id === category.category_id).length;
    if (childCount > 0) {
      toast.error(
        `Cannot delete category with ${childCount} child categories. Please delete or reassign them first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/pim/categories/${category.category_id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Category deleted successfully");
        fetchCategories();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete category");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  }

  // Filter categories based on search and active status
  const filteredCategories = categories.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = showInactive || cat.is_active;
    return matchesSearch && matchesActive;
  });

  // Auto-expand categories that match search
  useEffect(() => {
    if (searchQuery) {
      const matchingCategories = categories.filter((cat) =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const parentsToExpand = new Set<string>();
      matchingCategories.forEach((cat) => {
        cat.path.forEach((parentId) => parentsToExpand.add(parentId));
      });
      setExpandedCategories(parentsToExpand);
    }
  }, [searchQuery, categories]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  const rootCategories = filteredCategories.filter((c) => !c.parent_id);

  return (
    <>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Product Information Management", href: "/b2b/pim" },
            { label: "Categories" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Categories</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {categories.length} total • {rootCategories.length} root categories
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setParentCategory(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-5 w-5" />
            New Category
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search categories by name or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={expandAll}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition"
            title="Expand all"
          >
            <ChevronsDown className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition"
            title="Collapse all"
          >
            <ChevronsUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition ${
              showInactive
                ? "border-border bg-background"
                : "border-primary bg-primary/10 text-primary"
            }`}
            title="Filter"
          >
            <Filter className="h-5 w-5" />
            {!showInactive && "Active only"}
          </button>
        </div>

        {/* Categories Tree */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          {filteredCategories.length === 0 ? (
            <div className="p-12 text-center">
              <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? "No categories found" : "No categories yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first category to organize products"}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setParentCategory(null);
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  <Plus className="h-5 w-5" />
                  Create Category
                </button>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="p-2">
                {buildCategoryTree(
                  filteredCategories,
                  expandedCategories,
                  toggleExpand,
                  setParentCategory,
                  setShowCreateModal,
                  setEditingCategory,
                  handleDelete
                )}
              </div>
            </DndContext>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          parentCategory={parentCategory}
          categories={categories}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
            setParentCategory(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingCategory(null);
            setParentCategory(null);
            fetchCategories();
          }}
        />
      )}
    </>
  );
}

// Sortable Category Row Component
function SortableCategoryRow({
  category,
  level,
  hasChildren,
  isExpanded,
  onToggleExpand,
  onAddChild,
  onEdit,
  onDelete,
}: {
  category: Category;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.category_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 py-2.5 px-3 hover:bg-muted/50 rounded transition ${
          !category.is_active ? "opacity-60" : ""
        } ${isDragging ? "bg-muted" : ""}`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {/* Drag Handle */}
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Expand/Collapse */}
        <button
          type="button"
          onClick={onToggleExpand}
          className={`p-1 hover:bg-muted rounded transition ${!hasChildren ? "invisible" : ""}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Hero Image Thumbnail */}
        {category.hero_image?.url ? (
          <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
            <img
              src={category.hero_image.url}
              alt={category.hero_image.alt_text || category.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <FolderTree className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        {/* Category Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground truncate">{category.name}</h3>
            {!category.is_active && (
              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{category.slug}</p>
        </div>

        {/* Product Count */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{category.product_count}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddChild}
            className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
            title="Add child category"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
            title="Edit category"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition"
            title="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildCategoryTree(
  categories: Category[],
  expandedCategories: Set<string>,
  toggleExpand: (id: string) => void,
  setParentCategory: (cat: Category) => void,
  setShowCreateModal: (show: boolean) => void,
  setEditingCategory: (cat: Category) => void,
  handleDelete: (cat: Category) => void,
  parentId?: string,
  level = 0
): JSX.Element {
  const children = categories.filter((c) => (parentId ? c.parent_id === parentId : !c.parent_id));
  const sortedChildren = [...children].sort((a, b) => a.display_order - b.display_order);

  const childIds = sortedChildren.map((c) => c.category_id);

  return (
    <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
      <div>
        {sortedChildren.map((category) => {
          const hasChildren = categories.some((c) => c.parent_id === category.category_id);
          const isExpanded = expandedCategories.has(category.category_id);

          return (
            <div key={category.category_id}>
              <SortableCategoryRow
                category={category}
                level={level}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleExpand(category.category_id)}
                onAddChild={() => {
                  setParentCategory(category);
                  setShowCreateModal(true);
                }}
                onEdit={() => setEditingCategory(category)}
                onDelete={() => handleDelete(category)}
              />

              {/* Render children if expanded */}
              {isExpanded && hasChildren && (
                <div>
                  {buildCategoryTree(
                    categories,
                    expandedCategories,
                    toggleExpand,
                    setParentCategory,
                    setShowCreateModal,
                    setEditingCategory,
                    handleDelete,
                    category.category_id,
                    level + 1
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SortableContext>
  );
}

// Searchable Category Select Component
function SearchableCategorySelect({
  categories,
  value,
  onChange,
  excludeCategoryId,
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  excludeCategoryId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter available parents - exclude self and descendants
  const availableParents = categories
    .filter((c) => {
      if (!c.is_active) return false;
      if (c.category_id === excludeCategoryId) return false;

      // Check if this category is a descendant
      if (excludeCategoryId && c.path && c.path.includes(excludeCategoryId)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });

  // Recursive function to render category hierarchy
  const renderCategoryOptions = (parentId: string | null = null, level: number = 0): Category[] => {
    const children = availableParents
      .filter((c) => (parentId === null ? !c.parent_id : c.parent_id === parentId))
      .sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.name.localeCompare(b.name);
      });

    return children.flatMap((cat) => {
      const hasChildren = availableParents.some((c) => c.parent_id === cat.category_id);
      return [
        { ...cat, _displayLevel: level },
        ...(hasChildren ? renderCategoryOptions(cat.category_id, level + 1) : [])
      ] as Category[];
    });
  };

  const flatCategories = renderCategoryOptions();

  // Filter by search query
  const filteredCategories = searchQuery
    ? flatCategories.filter((cat) =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : flatCategories;

  // Get selected category name
  const selectedCategory = value ? categories.find((c) => c.category_id === value) : null;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-left focus:border-primary focus:outline-none flex items-center justify-between"
      >
        <span className={selectedCategory ? "text-foreground" : "text-muted-foreground"}>
          {selectedCategory ? selectedCategory.name : "None (Root Category)"}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
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

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto">
            {/* None option */}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setSearchQuery("");
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition ${
                !value ? "bg-primary/10 text-primary font-medium" : ""
              }`}
            >
              None (Root Category)
            </button>

            {/* Category options */}
            {filteredCategories.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No categories found
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const level = (cat as any)._displayLevel || 0;

                return (
                  <button
                    key={cat.category_id}
                    type="button"
                    onClick={() => {
                      onChange(cat.category_id);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full py-2.5 px-4 text-left text-sm hover:bg-muted transition ${
                      value === cat.category_id ? "bg-primary/10 text-primary font-medium" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Tree structure visualization */}
                      <div className="flex items-center gap-1 flex-shrink-0" style={{ width: `${level * 24}px` }}>
                        {level > 0 && (
                          <>
                            {Array(level - 1).fill(0).map((_, i) => (
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Category Create/Edit Modal Component
function CategoryModal({
  category,
  parentCategory,
  categories,
  onClose,
  onSuccess,
}: {
  category: Category | null;
  parentCategory: Category | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: category?.name || "",
    slug: category?.slug || "",
    description: category?.description || "",
    parent_id: category?.parent_id || parentCategory?.category_id || "",
    hero_image_url: category?.hero_image?.url || "",
    hero_image_alt: category?.hero_image?.alt_text || "",
    hero_image_cdn_key: category?.hero_image?.cdn_key || "",
    seo_title: category?.seo?.title || "",
    seo_description: category?.seo?.description || "",
    seo_keywords: category?.seo?.keywords?.join(", ") || "",
    display_order: category?.display_order || 0,
    is_active: category?.is_active ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: any = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        parent_id: formData.parent_id || undefined,
        display_order: formData.display_order,
        is_active: formData.is_active,
        seo: {
          title: formData.seo_title,
          description: formData.seo_description,
          keywords: formData.seo_keywords.split(",").map((k) => k.trim()).filter(Boolean),
        },
      };

      if (formData.hero_image_url) {
        payload.hero_image = {
          url: formData.hero_image_url,
          alt_text: formData.hero_image_alt,
          cdn_key: formData.hero_image_cdn_key,
        };
      }

      const url = category
        ? `/api/b2b/pim/categories/${category.category_id}`
        : "/api/b2b/pim/categories";

      const method = category ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(category ? "Category updated successfully" : "Category created successfully");
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save category");
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Failed to save category");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">
              {category ? "Edit Category" : "Create Category"}
            </h2>
            {parentCategory && (
              <p className="text-sm text-muted-foreground mt-1">Parent: {parentCategory.name}</p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({
                      ...formData,
                      name,
                      slug: formData.slug || generateSlug(name),
                    });
                  }}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Water Meters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="water-meters"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Category description..."
              />
            </div>

            {/* Parent Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Parent Category
              </label>
              <SearchableCategorySelect
                categories={categories}
                value={formData.parent_id || ""}
                onChange={(value) => setFormData({ ...formData, parent_id: value })}
                excludeCategoryId={category?.category_id}
              />
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {/* Hero Image */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Hero Image</label>

              {/* Image Upload */}
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file
                    if (!file.type.startsWith("image/")) {
                      toast.error("Please select an image file");
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be less than 5MB");
                      return;
                    }

                    // Upload to CDN
                    try {
                      const formData = new FormData();
                      formData.append("image", file);

                      const response = await fetch("/api/b2b/editor/upload-image", {
                        method: "POST",
                        body: formData,
                      });

                      if (!response.ok) {
                        throw new Error("Upload failed");
                      }

                      const data = await response.json();
                      setFormData((prev) => ({
                        ...prev,
                        hero_image_url: data.url,
                        hero_image_cdn_key: data.cdn_key,
                      }));
                      toast.success("Image uploaded successfully");
                    } catch (error) {
                      console.error("Upload error:", error);
                      toast.error("Failed to upload image");
                    }
                  }}
                  className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                />
                <input
                  type="url"
                  value={formData.hero_image_url}
                  onChange={(e) => setFormData({ ...formData, hero_image_url: e.target.value })}
                  placeholder="Or paste image URL..."
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              {/* Image Preview */}
              {formData.hero_image_url && (
                <div className="relative w-full h-48 rounded overflow-hidden bg-muted border border-border">
                  <img
                    src={formData.hero_image_url}
                    alt="Hero preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        hero_image_url: "",
                        hero_image_cdn_key: "",
                        hero_image_alt: "",
                      })
                    }
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    title="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Alt Text */}
              <input
                type="text"
                value={formData.hero_image_alt}
                onChange={(e) => setFormData({ ...formData, hero_image_alt: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Alt text for image"
              />
            </div>

            {/* SEO Fields */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="font-semibold text-foreground">SEO Settings</h4>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">SEO Title</label>
                <input
                  type="text"
                  value={formData.seo_title}
                  onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="SEO optimized title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  SEO Description
                </label>
                <textarea
                  value={formData.seo_description}
                  onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                  placeholder="SEO meta description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.seo_keywords}
                  onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="keyword1, keyword2, keyword3"
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="is_active" className="text-sm text-foreground">
                Active (visible to customers)
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-border hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSaving ? "Saving..." : category ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
