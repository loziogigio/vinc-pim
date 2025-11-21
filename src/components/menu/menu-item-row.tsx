"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Plus,
  Menu,
} from "lucide-react";
import { MenuItem } from "./menu-builder";

interface MenuItemRowProps {
  item: MenuItem;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MenuItemRow({
  item,
  level,
  hasChildren,
  isExpanded,
  onToggleExpand,
  onAddChild,
  onEdit,
  onDelete,
}: MenuItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.menu_item_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "collection":
        return "📦";
      case "category":
        return "🏷️";
      case "brand":
        return "🏢";
      case "tag":
        return "🔖";
      case "product_type":
        return "📋";
      case "product":
        return "🛍️";
      case "page":
        return "📄";
      case "url":
        return "🔗";
      case "search":
        return "🔍";
      case "divider":
        return "➖";
      default:
        return "•";
    }
  };

  const getTypeLabel = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getItemLabel = () => {
    if (item.label) return item.label;
    if (item.reference_id) return item.reference_id;
    if (item.url) return item.url;
    return "Untitled";
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 py-2.5 px-3 hover:bg-muted/50 rounded transition ${
          !item.is_active ? "opacity-60" : ""
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

        {/* Type Icon */}
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 text-lg">
          {getTypeIcon(item.type)}
        </div>

        {/* Menu Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground truncate">{getItemLabel()}</h3>
            {!item.is_active && (
              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                Inactive
              </span>
            )}
            {item.open_in_new_tab && (
              <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
            )}
            {(item.start_date || item.end_date) && (
              <span className="px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700">
                Time-bound
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 bg-gray-100 rounded">
              {getTypeLabel(item.type)}
            </span>
            {item.reference_id && item.type !== "url" && (
              <span className="truncate">ID: {item.reference_id}</span>
            )}
            {item.include_children && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                <ChevronRight className="w-3 h-3" />
                {item.max_depth ? `${item.max_depth} levels` : "All levels"}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddChild}
            className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
            title="Add child menu item"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition"
            title="Edit menu item"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition"
            title="Delete menu item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
