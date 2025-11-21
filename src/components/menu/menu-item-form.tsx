"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { MenuLocation } from "@/lib/db/models/menu";
import { MenuItem } from "./menu-builder";
import { EntitySelector } from "./entity-selector";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { ImageUpload } from "./ImageUpload";
import { toast } from "sonner";

interface MenuItemFormProps {
  location: MenuLocation;
  item: MenuItem | null; // null = create, otherwise edit
  parentItem?: MenuItem | null; // Pre-selected parent
  onClose: () => void;
}

export function MenuItemForm({ location, item, parentItem, onClose }: MenuItemFormProps) {
  const [formData, setFormData] = useState({
    type: item?.type || "collection",
    reference_id: item?.reference_id || "",
    label: item?.label || "",
    url: item?.url || "",
    icon: item?.icon || "",
    rich_text: item?.rich_text || "",
    image_url: item?.image_url || "",
    mobile_image_url: item?.mobile_image_url || "",
    parent_id: item?.parent_id || parentItem?.menu_item_id || "",
    include_children: item?.include_children || false,
    max_depth: item?.max_depth?.toString() || "",
    is_active: item?.is_active ?? true,
    start_date: item?.start_date || "",
    end_date: item?.end_date || "",
    open_in_new_tab: item?.open_in_new_tab || false,
    css_class: item?.css_class || "",
  });

  const [loading, setLoading] = useState(false);
  const [availableParents, setAvailableParents] = useState<MenuItem[]>([]);

  // Fetch available parent items
  useEffect(() => {
    const fetchParents = async () => {
      try {
        const res = await fetch(
          `/api/b2b/menu?location=${location}&include_inactive=true`
        );
        if (!res.ok) throw new Error("Failed to fetch menu items");
        const data = await res.json();

        // Filter out current item and its descendants to prevent circular refs
        let items = data.menuItems || [];
        if (item) {
          items = items.filter(
            (i: MenuItem) =>
              i.menu_item_id !== item.menu_item_id &&
              !i.path.includes(item.menu_item_id)
          );
        }

        setAvailableParents(items);
      } catch (error) {
        console.error("Error fetching parents:", error);
      }
    };

    fetchParents();
  }, [location, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      if ((formData.type === "url" || formData.type === "search") && !formData.url) {
        toast.error("URL is required for URL/Search type");
        setLoading(false);
        return;
      }

      if (
        formData.type !== "url" &&
        formData.type !== "search" &&
        formData.type !== "divider" &&
        !formData.reference_id
      ) {
        toast.error("Reference ID is required");
        setLoading(false);
        return;
      }

      const payload: any = {
        location,
        type: formData.type,
        reference_id: formData.reference_id || undefined,
        label: formData.label || undefined,
        url: formData.url || undefined,
        icon: formData.icon || undefined,
        rich_text: formData.rich_text || undefined,
        image_url: formData.image_url || undefined,
        mobile_image_url: formData.mobile_image_url || undefined,
        parent_id: formData.parent_id || undefined,
        include_children: formData.include_children,
        max_depth: formData.max_depth ? parseInt(formData.max_depth) : undefined,
        is_active: formData.is_active,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        open_in_new_tab: formData.open_in_new_tab,
        css_class: formData.css_class || undefined,
      };

      const url = item
        ? `/api/b2b/menu/${item.menu_item_id}`
        : `/api/b2b/menu`;
      const method = item ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save menu item");
      }

      toast.success(item ? "Menu item updated" : "Menu item created");
      onClose();
    } catch (error: any) {
      console.error("Error saving menu item:", error);
      toast.error(error.message || "Failed to save menu item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">
              {item ? "Edit Menu Item" : "Create Menu Item"}
            </h2>
            {parentItem && (
              <p className="text-sm text-muted-foreground mt-1">
                Parent: {parentItem.label || parentItem.reference_id}
              </p>
            )}
          </div>

          {/* Form Fields */}
          <div className="px-6 py-4 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                required
              >
                <option value="collection">Collection</option>
                <option value="category">Category</option>
                <option value="brand">Brand</option>
                <option value="tag">Tag</option>
                <option value="product_type">Product Type</option>
                <option value="product">Product</option>
                <option value="page">Page</option>
                <option value="url">URL</option>
                <option value="search">Search Product</option>
                <option value="divider">Divider</option>
              </select>
            </div>

            {/* Entity Selector (if not URL, search, or divider) */}
            {formData.type !== "url" && formData.type !== "search" && formData.type !== "divider" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Select {formData.type.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")} *
                </label>
                <EntitySelector
                  entityType={formData.type as "collection" | "category" | "brand" | "tag" | "product_type" | "product" | "page"}
                  value={formData.reference_id}
                  onChange={(value) =>
                    setFormData({ ...formData, reference_id: value })
                  }
                  placeholder={`Search for a ${formData.type.replace("_", " ")}...`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Start typing to search for {formData.type.replace("_", " ")}s
                </p>
              </div>
            )}

            {/* URL (if type is URL) */}
            {formData.type === "url" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com"
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                />
              </div>
            )}

            {/* Search Product Fields */}
            {formData.type === "search" && (
              <div className="space-y-4 rounded border border-border bg-background p-4">
                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Search URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="/search or https://example.com/search"
                    className="w-full rounded border border-border bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Link to search page or search functionality
                  </p>
                </div>

                {/* Rich Text Description */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Rich Text Description (Optional)
                  </label>
                  <RichTextEditor
                    content={formData.rich_text}
                    onChange={(html) =>
                      setFormData({ ...formData, rich_text: html })
                    }
                    placeholder="Enter description or promotional text..."
                    minHeight="150px"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the toolbar for formatting or click the &lt;/&gt; icon to edit HTML directly
                  </p>
                </div>

                {/* Desktop Image */}
                <ImageUpload
                  value={formData.image_url}
                  onChange={(url) => setFormData({ ...formData, image_url: url })}
                  label="Desktop Image (Optional)"
                />

                {/* Mobile Image */}
                <ImageUpload
                  value={formData.mobile_image_url}
                  onChange={(url) => setFormData({ ...formData, mobile_image_url: url })}
                  label="Mobile Image (Optional)"
                />
              </div>
            )}

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Custom Label (Optional)
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Override default name"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use entity's name
              </p>
            </div>

            {/* Icon/Image for menu item */}
            {formData.type !== "divider" && (
              <div>
                <ImageUpload
                  value={formData.icon}
                  onChange={(url) => setFormData({ ...formData, icon: url })}
                  label="Menu Item Icon/Image (Optional)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Small icon or image to display next to the menu item label
                </p>
              </div>
            )}

            {/* Parent */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Parent Menu Item (Optional)
              </label>
              <select
                value={formData.parent_id}
                onChange={(e) =>
                  setFormData({ ...formData, parent_id: e.target.value })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">-- Root Level --</option>
                {availableParents.map((parent) => (
                  <option key={parent.menu_item_id} value={parent.menu_item_id}>
                    {"  ".repeat(parent.level)} {parent.label || parent.reference_id}
                  </option>
                ))}
              </select>
            </div>

            {/* Include Children Toggle */}
            {(formData.type === "category" || formData.type === "collection") && (
              <div className="rounded border border-border bg-background p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.include_children}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        include_children: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-primary"
                  />
                  <div>
                    <span className="font-medium text-sm text-foreground">
                      Include Children Hierarchy
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Show subcategories/child collections in the menu
                    </p>
                  </div>
                </label>

                {/* Max Depth */}
                {formData.include_children && (
                  <div className="mt-3 pl-6">
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Max Depth (Optional)
                    </label>
                    <select
                      value={formData.max_depth}
                      onChange={(e) =>
                        setFormData({ ...formData, max_depth: e.target.value })
                      }
                      className="w-full rounded border border-border bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      <option value="">All Levels</option>
                      <option value="1">1 Level (Root Only)</option>
                      <option value="2">2 Levels</option>
                      <option value="3">3 Levels</option>
                      <option value="4">4 Levels</option>
                      <option value="5">5 Levels</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Limit how many levels of hierarchy to display
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Time-bound visibility */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Start Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Active</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.open_in_new_tab}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      open_in_new_tab: e.target.checked,
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Open in new tab</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-border hover:bg-muted transition text-foreground"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : item ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
