"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { MenuLocation } from "@/lib/db/models/menu";

interface MenuItem {
  menu_item_id: string;
  type: string;
  reference_id?: string;
  label?: string;
  url?: string;
  include_children: boolean;
  max_depth?: number;
  open_in_new_tab: boolean;
  children?: MenuItem[];
}

interface MenuData {
  menu_item_id: string;
  type: string;
  reference_id?: string;
  label?: string;
  url?: string;
  include_children: boolean;
  max_depth?: number;
  open_in_new_tab: boolean;
  entity?: any; // The actual entity data (category, collection, etc.)
  children?: MenuData[];
}

interface MenuRendererProps {
  location: MenuLocation;
  className?: string;
  variant?: "horizontal" | "vertical" | "mega";
  onItemClick?: () => void;
}

export function MenuRenderer({
  location,
  className = "",
  variant = "horizontal",
  onItemClick,
}: MenuRendererProps) {
  const [menuData, setMenuData] = useState<MenuData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/b2b/menu?location=${location}`);
        if (!res.ok) throw new Error("Failed to fetch menu");
        const data = await res.json();

        // Build menu tree with entity data
        const tree = await buildMenuTree(data.menuItems || []);
        setMenuData(tree);
      } catch (error) {
        console.error("Error fetching menu:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [location]);

  // Build hierarchical menu with entity data
  const buildMenuTree = async (items: any[]): Promise<MenuData[]> => {
    const rootItems = items.filter((item) => !item.parent_id);

    const buildNode = async (item: any): Promise<MenuData> => {
      const node: MenuData = {
        menu_item_id: item.menu_item_id,
        type: item.type,
        reference_id: item.reference_id,
        label: item.label,
        url: item.url,
        include_children: item.include_children,
        max_depth: item.max_depth,
        open_in_new_tab: item.open_in_new_tab,
        children: [],
      };

      // Fetch entity data if needed
      if (item.type !== "url" && item.type !== "divider" && item.reference_id) {
        node.entity = await fetchEntityData(item.type, item.reference_id);
      }

      // Add direct children from menu structure
      const directChildren = items.filter((i) => i.parent_id === item.menu_item_id);
      for (const child of directChildren) {
        node.children!.push(await buildNode(child));
      }

      // If include_children is enabled, fetch entity children
      if (
        item.include_children &&
        (item.type === "category" || item.type === "collection")
      ) {
        const entityChildren = await fetchEntityChildren(
          item.type,
          item.reference_id,
          item.max_depth
        );
        node.children!.push(...entityChildren);
      }

      return node;
    };

    const tree = [];
    for (const item of rootItems) {
      tree.push(await buildNode(item));
    }

    return tree;
  };

  // Fetch entity data (category, collection, etc.)
  const fetchEntityData = async (type: string, id: string) => {
    try {
      let endpoint = "";
      switch (type) {
        case "collection":
          endpoint = `/api/b2b/pim/collections/${id}`;
          break;
        case "category":
          endpoint = `/api/b2b/pim/categories/${id}`;
          break;
        case "brand":
          endpoint = `/api/b2b/pim/brands/${id}`;
          break;
        case "tag":
          endpoint = `/api/b2b/pim/tags/${id}`;
          break;
        default:
          return null;
      }

      const res = await fetch(endpoint);
      if (!res.ok) return null;
      const data = await res.json();
      return data.collection || data.category || data.brand || data.tag || null;
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      return null;
    }
  };

  // Fetch entity children (recursive subcategories, etc.)
  const fetchEntityChildren = async (
    type: string,
    parentId: string,
    maxDepth?: number,
    currentDepth: number = 0
  ): Promise<MenuData[]> => {
    if (maxDepth !== undefined && currentDepth >= maxDepth) {
      return [];
    }

    try {
      // For now, we'll just return empty array
      // You'll need to implement entity children fetching based on your API
      // Example: /api/b2b/pim/categories?parent_id=${parentId}
      return [];
    } catch (error) {
      console.error("Error fetching entity children:", error);
      return [];
    }
  };

  // Get URL for menu item
  const getItemUrl = (item: MenuData): string => {
    if (item.url) return item.url;

    if (item.entity) {
      const slug = item.entity.slug;
      switch (item.type) {
        case "collection":
          return `/collections/${slug}`;
        case "category":
          return `/categories/${slug}`;
        case "brand":
          return `/brands/${slug}`;
        case "tag":
          return `/tags/${slug}`;
        case "product":
          return `/products/${slug}`;
        case "page":
          return `/${slug}`;
        default:
          return "#";
      }
    }

    return "#";
  };

  // Get label for menu item
  const getItemLabel = (item: MenuData): string => {
    if (item.label) return item.label;
    if (item.entity?.name) return item.entity.name;
    if (item.url) return item.url;
    return "Untitled";
  };

  // Toggle submenu
  const toggleMenu = (menuId: string) => {
    const newSet = new Set(openMenus);
    if (newSet.has(menuId)) {
      newSet.delete(menuId);
    } else {
      newSet.add(menuId);
    }
    setOpenMenus(newSet);
  };

  // Render menu item
  const renderMenuItem = (item: MenuData, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.has(item.menu_item_id);
    const url = getItemUrl(item);
    const label = getItemLabel(item);

    if (item.type === "divider") {
      return (
        <div key={item.menu_item_id} className="my-2 border-t border-gray-200" />
      );
    }

    const linkProps = item.open_in_new_tab
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};

    return (
      <div key={item.menu_item_id} className={depth > 0 ? "ml-4" : ""}>
        <div className="flex items-center">
          <Link
            href={url}
            {...linkProps}
            onClick={onItemClick}
            className="flex-1 py-2 px-3 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
          >
            <span>{label}</span>
            {item.open_in_new_tab && (
              <ExternalLink className="w-3 h-3 text-gray-400" />
            )}
          </Link>

          {hasChildren && (
            <button
              onClick={() => toggleMenu(item.menu_item_id)}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>

        {hasChildren && isOpen && (
          <div className="ml-2">
            {item.children!.map((child) => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-40"></div>
      </div>
    );
  }

  if (menuData.length === 0) {
    return null;
  }

  return (
    <nav className={className}>
      {variant === "horizontal" && (
        <div className="flex items-center gap-1">
          {menuData.map((item) => renderMenuItem(item))}
        </div>
      )}

      {variant === "vertical" && (
        <div className="space-y-1">
          {menuData.map((item) => renderMenuItem(item))}
        </div>
      )}

      {variant === "mega" && (
        <div className="grid grid-cols-4 gap-6">
          {menuData.map((item) => (
            <div key={item.menu_item_id}>
              <h3 className="font-semibold mb-2">{getItemLabel(item)}</h3>
              {item.children && item.children.length > 0 && (
                <div className="space-y-1">
                  {item.children.map((child) => renderMenuItem(child))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
