"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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
  ExternalLink,
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
import CategoryModal, { CategoryRecord } from "./_components/category-modal";

type Category = CategoryRecord & {
  _id: string;
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
          <Link
            href={`/b2b/pim/categories/${category.category_id}`}
            className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
            title="View category"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
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
