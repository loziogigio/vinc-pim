"use client";

import { useState, useEffect } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Plus,
  Search,
  ChevronsDown,
  ChevronsUp,
  Filter,
  Menu as MenuIcon,
} from "lucide-react";
import { MenuItemRow } from "./menu-item-row";
import { MenuItemForm } from "./menu-item-form";
import { MenuLocation } from "@/lib/db/models/menu";
import { toast } from "sonner";

export interface MenuItem {
  menu_item_id: string;
  // wholesaler_id removed - database per wholesaler provides isolation
  location: MenuLocation;
  type: string;
  reference_id?: string;
  label?: string;
  url?: string;
  icon?: string;
  rich_text?: string;
  image_url?: string;
  mobile_image_url?: string;
  parent_id?: string;
  level: number;
  path: string[];
  include_children: boolean;
  max_depth?: number;
  position: number;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  open_in_new_tab: boolean;
  css_class?: string;
}

interface MenuBuilderProps {
  location: MenuLocation;
  onSave?: () => void;
}

export function MenuBuilder({ location, onSave }: MenuBuilderProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [parentItem, setParentItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch menu items
  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/b2b/menu?location=${location}&include_inactive=true`
      );
      if (!res.ok) throw new Error("Failed to fetch menu items");
      const data = await res.json();
      setMenuItems(data.menuItems || []);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      toast.error("Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, [location]);

  function toggleExpand(itemId: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function expandAll() {
    const allIds = new Set(menuItems.map((i) => i.menu_item_id));
    setExpandedItems(allIds);
  }

  function collapseAll() {
    setExpandedItems(new Set());
  }

  // Handle drag end - only reorder within same parent
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeItem = menuItems.find((i) => i.menu_item_id === active.id);
    const overItem = menuItems.find((i) => i.menu_item_id === over.id);

    if (!activeItem || !overItem) return;

    // Only allow reordering within the same parent
    if (activeItem.parent_id !== overItem.parent_id) {
      toast.error("Can only reorder menu items within the same level");
      return;
    }

    // Get siblings at the same level
    const siblings = menuItems.filter((i) => i.parent_id === activeItem.parent_id);
    const oldIndex = siblings.findIndex((i) => i.menu_item_id === active.id);
    const newIndex = siblings.findIndex((i) => i.menu_item_id === over.id);

    const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex);

    // Update positions
    const updates = reorderedSiblings.map((item, index) => ({
      menu_item_id: item.menu_item_id,
      position: index,
      parent_id: item.parent_id,
    }));

    // Optimistically update UI
    setMenuItems((prev) => {
      const updated = [...prev];
      updates.forEach((update) => {
        const item = updated.find((i) => i.menu_item_id === update.menu_item_id);
        if (item) {
          item.position = update.position;
        }
      });
      return updated;
    });

    // Persist to API
    try {
      const res = await fetch("/api/b2b/menu/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates }),
      });

      if (!res.ok) throw new Error("Failed to reorder");

      toast.success("Menu items reordered successfully");
    } catch (error) {
      console.error("Error reordering menu:", error);
      toast.error("Failed to reorder menu items");
      fetchMenuItems(); // Revert on error
    }
  };

  // Handle delete
  const handleDelete = async (item: MenuItem) => {
    const childCount = menuItems.filter((i) => i.parent_id === item.menu_item_id).length;
    if (childCount > 0) {
      if (!confirm(`This menu item has ${childCount} children. Delete all?`)) {
        return;
      }
    }

    if (!confirm(`Are you sure you want to delete "${item.label || item.reference_id}"?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/b2b/menu/${item.menu_item_id}?delete_children=true`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }

      toast.success("Menu item deleted successfully");
      fetchMenuItems();
      onSave?.();
    } catch (error: any) {
      console.error("Error deleting menu item:", error);
      toast.error(error.message || "Failed to delete menu item");
    }
  };

  // Handle edit
  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setParentItem(null);
    setShowForm(true);
  };

  // Handle add child
  const handleAddChild = (item: MenuItem) => {
    setParentItem(item);
    setEditingItem(null);
    setShowForm(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);
    setParentItem(null);
    fetchMenuItems();
    onSave?.();
  };

  // Filter menu items
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      (item.label?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (item.reference_id?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (item.url?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesActive = showInactive || item.is_active;
    return matchesSearch && matchesActive;
  });

  // Auto-expand items that match search
  useEffect(() => {
    if (searchQuery) {
      const matchingItems = menuItems.filter((item) =>
        (item.label?.toLowerCase() || "").includes(searchQuery.toLowerCase())
      );
      const parentsToExpand = new Set<string>();
      matchingItems.forEach((item) => {
        item.path.forEach((parentId) => parentsToExpand.add(parentId));
      });
      setExpandedItems(parentsToExpand);
    }
  }, [searchQuery, menuItems]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  const rootItems = filteredItems.filter((i) => !i.parent_id);
  const locationTitle = location.charAt(0).toUpperCase() + location.slice(1);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{locationTitle} Menu</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {menuItems.length} total • {rootItems.length} root items
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setParentItem(null);
              setEditingItem(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-5 w-5" />
            New Menu Item
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search menu items..."
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

        {/* Menu Items Tree */}
        <div className="rounded-lg bg-card shadow-sm border border-border">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <MenuIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? "No menu items found" : "No menu items yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : `Create your first ${locationTitle.toLowerCase()} menu item`}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setParentItem(null);
                    setEditingItem(null);
                    setShowForm(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  <Plus className="h-5 w-5" />
                  Create Menu Item
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
                {buildMenuTree(
                  filteredItems,
                  expandedItems,
                  toggleExpand,
                  handleAddChild,
                  handleEdit,
                  handleDelete
                )}
              </div>
            </DndContext>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <MenuItemForm
          location={location}
          item={editingItem}
          parentItem={parentItem}
          onClose={handleFormClose}
        />
      )}
    </>
  );
}

// Build menu tree recursively
function buildMenuTree(
  items: MenuItem[],
  expandedItems: Set<string>,
  toggleExpand: (id: string) => void,
  onAddChild: (item: MenuItem) => void,
  onEdit: (item: MenuItem) => void,
  onDelete: (item: MenuItem) => void,
  parentId?: string,
  level = 0
): JSX.Element {
  const children = items.filter((i) => (parentId ? i.parent_id === parentId : !i.parent_id));
  const sortedChildren = [...children].sort((a, b) => a.position - b.position);

  const childIds = sortedChildren.map((i) => i.menu_item_id);

  return (
    <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
      <div>
        {sortedChildren.map((item) => {
          const hasChildren = items.some((i) => i.parent_id === item.menu_item_id);
          const isExpanded = expandedItems.has(item.menu_item_id);

          return (
            <div key={item.menu_item_id}>
              <MenuItemRow
                item={item}
                level={level}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleExpand(item.menu_item_id)}
                onAddChild={() => onAddChild(item)}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />

              {/* Render children if expanded */}
              {isExpanded && hasChildren && (
                <div>
                  {buildMenuTree(
                    items,
                    expandedItems,
                    toggleExpand,
                    onAddChild,
                    onEdit,
                    onDelete,
                    item.menu_item_id,
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
