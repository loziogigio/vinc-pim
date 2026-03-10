"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  GripVertical,
  Loader2,
  Send,
  Image,
  Search,
  Radio,
  Menu,
  ShoppingCart,
  Building2,
  EyeOff,
  Heart,
  GitCompare,
  User,
  Bell,
  History,
  LayoutGrid,
  Square,
  Space,
  Minus,
  Upload,
  X,
  Save,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccordionItem, AccordionGroup } from "@/components/ui/accordion";
import { cn } from "@/components/ui/utils";
import { useImageUpload } from "@/hooks/useImageUpload";
import { SectionCard } from "./section-card";
import type { HeaderConfig } from "./types";
import type {
  HeaderRow,
  HeaderBlock,
  HeaderWidget,
  RowLayout,
  HeaderWidgetType,
  BlockAlignment,
  RadioStation,
} from "@/lib/types/home-settings";
import {
  LAYOUT_WIDTHS,
  LAYOUT_BLOCK_COUNT,
  HEADER_WIDGET_LIBRARY,
} from "@/lib/types/home-settings";

// ============================================
// Default B2C Header Config (classic 3-row layout)
// ============================================

export const DEFAULT_B2C_HEADER_CONFIG: HeaderConfig = {
  rows: [
    {
      id: "row-announcement",
      enabled: true,
      fixed: false,
      backgroundColor: "#009688",
      textColor: "#ffffff",
      layout: "full",
      blocks: [
        {
          id: "row-announcement-full",
          alignment: "right",
          widgets: [
            { id: "btn-chi-siamo", type: "button", config: { label: "CHI SIAMO", url: "/chi-siamo", variant: "ghost" } },
          ],
        },
      ],
    },
    {
      id: "row-main",
      enabled: true,
      fixed: false,
      backgroundColor: "#ffffff",
      layout: "20-60-20",
      blocks: [
        {
          id: "row-main-left",
          alignment: "left",
          widgets: [
            { id: "widget-logo", type: "logo", config: {} },
          ],
        },
        {
          id: "row-main-center",
          alignment: "center",
          widgets: [
            { id: "widget-search", type: "search-bar", config: { placeholder: "Cerca prodotti...", width: "full" } },
          ],
        },
        {
          id: "row-main-right",
          alignment: "right",
          widgets: [
            { id: "widget-profile", type: "profile", config: {} },
            { id: "widget-favorites", type: "favorites", config: {} },
            { id: "widget-reminders", type: "reminders", config: {} },
            { id: "widget-cart", type: "cart", config: {} },
          ],
        },
      ],
    },
    {
      id: "row-categories",
      enabled: true,
      fixed: false,
      backgroundColor: "#f8f9fa",
      layout: "full",
      blocks: [
        {
          id: "row-categories-full",
          alignment: "left",
          widgets: [
            { id: "widget-catmenu", type: "category-menu", config: { label: "Categorie" } },
          ],
        },
      ],
    },
  ],
};

// ============================================
// Constants
// ============================================

const LAYOUT_OPTIONS: { value: RowLayout; label: string }[] = [
  { value: "full", label: "Full Width" },
  { value: "50-50", label: "50-50" },
  { value: "20-60-20", label: "20-60-20" },
  { value: "25-50-25", label: "25-50-25" },
  { value: "30-40-30", label: "30-40-30" },
  { value: "33-33-33", label: "33-33-33" },
];

const WIDGET_ICONS: Record<HeaderWidgetType, typeof Image> = {
  "logo": Image,
  "search-bar": Search,
  "radio-widget": Radio,
  "category-menu": Menu,
  "cart": ShoppingCart,
  "company-info": Building2,
  "no-price": EyeOff,
  "favorites": Heart,
  "compare": GitCompare,
  "profile": User,
  "notifications": Bell,
  "reminders": History,
  "app-launcher": LayoutGrid,
  "button": Square,
  "spacer": Space,
  "divider": Minus,
};

// ============================================
// Menu Widget Config (fetches menu status for channel)
// ============================================

function MenuWidgetConfig({
  channel,
  config,
  onConfigChange,
}: {
  channel?: string;
  config: { label?: string };
  onConfigChange: (updates: Record<string, unknown>) => void;
}) {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channel) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/b2b/menu?location=header&channel=${encodeURIComponent(channel)}`)
      .then((res) => res.ok ? res.json() : { menuItems: [] })
      .then((data) => setMenuItems(data.menuItems || []))
      .catch(() => setMenuItems([]))
      .finally(() => setLoading(false));
  }, [channel]);

  const rootItems = menuItems.filter((item) => !item.parent_id);
  const hasMenu = rootItems.length > 0;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600">Label</label>
        <input
          type="text"
          value={config.label || ""}
          onChange={(e) => onConfigChange({ label: e.target.value })}
          placeholder="Menu"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
        />
      </div>

      {/* Menu status for channel */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-slate-600">Linked Menu</span>
          {channel && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
              {channel}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            <span className="text-xs text-slate-500">Loading...</span>
          </div>
        ) : !channel ? (
          <div className="flex items-center gap-2 py-2 text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs">No channel assigned to this storefront</span>
          </div>
        ) : hasMenu ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-slate-700">
                {rootItems.length} root item{rootItems.length !== 1 ? "s" : ""} ({menuItems.length} total)
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {rootItems.slice(0, 8).map((item) => (
                <span key={item.menu_item_id} className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200">
                  {item.label || item.reference_id || item.type}
                </span>
              ))}
              {rootItems.length > 8 && (
                <span className="text-[11px] text-slate-400">+{rootItems.length - 8} more</span>
              )}
            </div>
            <Link
              href={`/b2b/pim/menu-settings?channel=${encodeURIComponent(channel)}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              Edit menu <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 py-1 text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs">No menu configured for this channel</span>
            </div>
            <Link
              href={`/b2b/pim/menu-settings?channel=${encodeURIComponent(channel)}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Create Menu
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Widget Adder
// ============================================

function WidgetAdder({
  onAdd,
  usedTypes,
}: {
  onAdd: (type: HeaderWidgetType) => void;
  usedTypes: Set<HeaderWidgetType>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const availableWidgets = (
    Object.entries(HEADER_WIDGET_LIBRARY) as [HeaderWidgetType, (typeof HEADER_WIDGET_LIBRARY)[HeaderWidgetType]][]
  ).filter(([type, meta]) => meta.allowMultiple || !usedTypes.has(type));

  if (availableWidgets.length === 0) return null;

  function handleToggle() {
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 256) });
    }
    setIsOpen(!isOpen);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-center rounded-md border border-dashed border-slate-300 p-1 text-slate-400 transition-colors hover:border-[#009688] hover:text-[#009688]"
      >
        <Plus className="h-4 w-4" />
      </button>
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-[9999] w-64 rounded-lg border border-slate-200 bg-white shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <span className="text-xs font-medium text-slate-600">Add Widget</span>
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {availableWidgets.map(([type, meta]) => {
                const Icon = WIDGET_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { onAdd(type); setIsOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-700">{meta.label}</div>
                      <div className="text-xs text-slate-500 truncate">{meta.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// ============================================
// Widget Config Panel
// ============================================

function WidgetConfigPanel({
  headerConfig,
  selectedWidget,
  onUpdate,
  onClose,
  channel,
}: {
  headerConfig: HeaderConfig;
  selectedWidget: { rowId: string; blockId: string; widgetId: string };
  onUpdate: (config: HeaderConfig) => void;
  onClose: () => void;
  channel?: string;
}) {
  const radioLogoUploader = useImageUpload();
  const row = headerConfig.rows.find((r) => r.id === selectedWidget.rowId);
  const block = row?.blocks.find((b) => b.id === selectedWidget.blockId);
  const widget = block?.widgets.find((w) => w.id === selectedWidget.widgetId);

  if (!widget || !block) return null;

  const meta = HEADER_WIDGET_LIBRARY[widget.type];
  const Icon = WIDGET_ICONS[widget.type];
  const currentIndex = block.widgets.findIndex((w) => w.id === selectedWidget.widgetId);
  const currentPosition = currentIndex + 1;
  const totalWidgets = block.widgets.length;

  const updateWidgetConfig = (updates: Record<string, unknown>) => {
    onUpdate({
      ...headerConfig,
      rows: headerConfig.rows.map((r) =>
        r.id === selectedWidget.rowId
          ? {
              ...r,
              blocks: r.blocks.map((b) =>
                b.id === selectedWidget.blockId
                  ? { ...b, widgets: b.widgets.map((w) => (w.id === selectedWidget.widgetId ? { ...w, config: { ...w.config, ...updates } } : w)) }
                  : b
              ),
            }
          : r
      ),
    });
  };

  const moveWidgetToPosition = (newPosition: number) => {
    const newIndex = Math.max(0, Math.min(newPosition - 1, totalWidgets - 1));
    if (newIndex === currentIndex) return;
    const newWidgets = [...block.widgets];
    const [movedWidget] = newWidgets.splice(currentIndex, 1);
    newWidgets.splice(newIndex, 0, movedWidget);
    onUpdate({
      ...headerConfig,
      rows: headerConfig.rows.map((r) =>
        r.id === selectedWidget.rowId
          ? { ...r, blocks: r.blocks.map((b) => (b.id === selectedWidget.blockId ? { ...b, widgets: newWidgets } : b)) }
          : r
      ),
    });
  };

  return (
    <SectionCard title={`Configure: ${meta.label}`} description={meta.description}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <Icon className="h-5 w-5 text-slate-500" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-700">{meta.label}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => moveWidgetToPosition(currentPosition - 1)} disabled={currentPosition === 1} className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronUp className="h-4 w-4 -rotate-90" />
            </button>
            <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1">
              <span className="text-xs font-medium text-slate-700">{currentPosition}</span>
              <span className="text-xs text-slate-400">/ {totalWidgets}</span>
            </div>
            <button type="button" onClick={() => moveWidgetToPosition(currentPosition + 1)} disabled={currentPosition === totalWidgets} className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Button widget config */}
        {widget.type === "button" && (() => {
          const config = (widget.config || {}) as { label?: string; url?: string; target?: string; variant?: string; backgroundColor?: string; textColor?: string };
          return (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Label</label>
                <input type="text" value={config.label || ""} onChange={(e) => updateWidgetConfig({ label: e.target.value })} placeholder="Button text" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">URL</label>
                <input type="text" value={config.url || ""} onChange={(e) => updateWidgetConfig({ url: e.target.value })} placeholder="/path or https://..." className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Open In</label>
                <select value={config.target || "_self"} onChange={(e) => updateWidgetConfig({ target: e.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none">
                  <option value="_self">Same Tab</option>
                  <option value="_blank">New Tab</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Variant</label>
                <select value={config.variant || "primary"} onChange={(e) => updateWidgetConfig({ variant: e.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none">
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="outline">Outline</option>
                  <option value="ghost">Ghost</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Background</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={config.backgroundColor || "#009688"} onChange={(e) => updateWidgetConfig({ backgroundColor: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-slate-200" />
                    <input type="text" value={config.backgroundColor || ""} onChange={(e) => updateWidgetConfig({ backgroundColor: e.target.value })} placeholder="#009688" className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-[#009688] focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Text Color</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={config.textColor || "#ffffff"} onChange={(e) => updateWidgetConfig({ textColor: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-slate-200" />
                    <input type="text" value={config.textColor || ""} onChange={(e) => updateWidgetConfig({ textColor: e.target.value })} placeholder="#ffffff" className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-[#009688] focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Search bar config */}
        {widget.type === "search-bar" && (() => {
          const config = (widget.config || {}) as { placeholder?: string; width?: string };
          return (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Placeholder</label>
                <input type="text" value={config.placeholder || ""} onChange={(e) => updateWidgetConfig({ placeholder: e.target.value })} placeholder="Search products..." className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Width</label>
                <select value={config.width || "lg"} onChange={(e) => updateWidgetConfig({ width: e.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none">
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="full">Full</option>
                </select>
              </div>
            </div>
          );
        })()}

        {/* Menu config */}
        {widget.type === "category-menu" && (
          <MenuWidgetConfig
            channel={channel}
            config={(widget.config || {}) as { label?: string }}
            onConfigChange={updateWidgetConfig}
          />
        )}

        {/* Radio widget config */}
        {widget.type === "radio-widget" && (() => {
          const config = (widget.config || {}) as { enabled?: boolean; headerIcon?: string; stations?: RadioStation[] };
          const stations = config.stations || [];
          return (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.enabled !== false} onChange={(e) => updateWidgetConfig({ enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                <span className="text-sm text-slate-600">Enabled</span>
              </label>
              <div>
                <label className="text-xs font-medium text-slate-600">Header Icon URL</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="text" value={config.headerIcon || ""} onChange={(e) => updateWidgetConfig({ headerIcon: e.target.value })} placeholder="/assets/radio-icon.png" className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-[#009688] focus:outline-none" />
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { radioLogoUploader.uploadImage(file).then((url) => { if (url) updateWidgetConfig({ headerIcon: url }); }); e.target.value = ""; }
                    }} />
                    <span className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Upload className="h-4 w-4" /></span>
                  </label>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">Stations</label>
                  <button type="button" onClick={() => updateWidgetConfig({ stations: [...stations, { id: `station-${Date.now()}`, name: "", logoUrl: "", streamUrl: "" }] })} className="flex items-center gap-1 text-xs text-[#009688]"><Plus className="h-3 w-3" /> Add</button>
                </div>
                {stations.map((station, idx) => (
                  <div key={station.id} className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">Station {idx + 1}</span>
                      <button type="button" onClick={() => updateWidgetConfig({ stations: stations.filter((s) => s.id !== station.id) })} className="p-0.5 text-slate-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                    </div>
                    <input type="text" value={station.name} onChange={(e) => updateWidgetConfig({ stations: stations.map((s) => s.id === station.id ? { ...s, name: e.target.value } : s) })} placeholder="Name" className="w-full rounded border border-slate-200 px-2 py-1 text-xs" />
                    <input type="text" value={station.streamUrl} onChange={(e) => updateWidgetConfig({ stations: stations.map((s) => s.id === station.id ? { ...s, streamUrl: e.target.value } : s) })} placeholder="Stream URL" className="w-full rounded border border-slate-200 px-2 py-1 text-xs" />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </SectionCard>
  );
}

// ============================================
// Header Section (main export)
// ============================================

export function HeaderSection({
  headerConfig,
  headerConfigDraft,
  onDraftChange,
  onPublish,
  saving,
  onSave,
  channel,
}: {
  headerConfig: HeaderConfig;
  headerConfigDraft: HeaderConfig;
  onDraftChange: (config: HeaderConfig) => void;
  onPublish: () => Promise<void>;
  saving: boolean;
  onSave: () => void;
  channel?: string;
}) {
  const [selectedWidget, setSelectedWidget] = useState<{ rowId: string; blockId: string; widgetId: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const hasUnpublishedChanges = JSON.stringify(headerConfigDraft) !== JSON.stringify(headerConfig);

  const handlePublish = async () => {
    setIsPublishing(true);
    try { await onPublish(); } finally { setIsPublishing(false); }
  };

  const updateRow = (rowId: string, updates: Partial<HeaderRow>) => {
    onDraftChange({
      ...headerConfigDraft,
      rows: headerConfigDraft.rows.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    });
  };

  const updateBlock = (rowId: string, blockId: string, updates: Partial<HeaderBlock>) => {
    onDraftChange({
      ...headerConfigDraft,
      rows: headerConfigDraft.rows.map((row) =>
        row.id === rowId
          ? { ...row, blocks: row.blocks.map((block) => (block.id === blockId ? { ...block, ...updates } : block)) }
          : row
      ),
    });
  };

  const addRow = () => {
    const newRowId = `row-${Date.now()}`;
    const newRow: HeaderRow = {
      id: newRowId,
      enabled: true,
      fixed: false,
      backgroundColor: "#ffffff",
      layout: "50-50",
      blocks: [
        { id: `${newRowId}-left`, alignment: "left", widgets: [] },
        { id: `${newRowId}-right`, alignment: "right", widgets: [] },
      ],
    };
    onDraftChange({ ...headerConfigDraft, rows: [...headerConfigDraft.rows, newRow] });
  };

  const deleteRow = (rowId: string) => {
    onDraftChange({ ...headerConfigDraft, rows: headerConfigDraft.rows.filter((row) => row.id !== rowId) });
  };

  const moveRow = (rowId: string, direction: "up" | "down") => {
    const index = headerConfigDraft.rows.findIndex((r) => r.id === rowId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === headerConfigDraft.rows.length - 1) return;
    const newRows = [...headerConfigDraft.rows];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    onDraftChange({ ...headerConfigDraft, rows: newRows });
  };

  const changeLayout = (rowId: string, newLayout: RowLayout) => {
    const row = headerConfigDraft.rows.find((r) => r.id === rowId);
    if (!row) return;
    const blockCount = LAYOUT_BLOCK_COUNT[newLayout];
    let newBlocks = [...row.blocks];
    if (blockCount > newBlocks.length) {
      const blockNames = ["left", "center", "right"];
      for (let i = newBlocks.length; i < blockCount; i++) {
        newBlocks.push({ id: `${rowId}-${blockNames[i] || `block-${i}`}`, alignment: (i === 0 ? "left" : i === blockCount - 1 ? "right" : "center") as BlockAlignment, widgets: [] });
      }
    } else if (blockCount < newBlocks.length) {
      const removedBlocks = newBlocks.slice(blockCount);
      const removedWidgets = removedBlocks.flatMap((b) => b.widgets);
      newBlocks = newBlocks.slice(0, blockCount);
      if (newBlocks.length > 0) newBlocks[newBlocks.length - 1].widgets.push(...removedWidgets);
    }
    updateRow(rowId, { layout: newLayout, blocks: newBlocks });
  };

  const addWidgetToBlock = (rowId: string, blockId: string, widgetType: HeaderWidgetType) => {
    const row = headerConfigDraft.rows.find((r) => r.id === rowId);
    if (!row) return;
    const block = row.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const widgetMeta = HEADER_WIDGET_LIBRARY[widgetType];
    if (!widgetMeta.allowMultiple) {
      const allWidgets = headerConfigDraft.rows.flatMap((r) => r.blocks.flatMap((b) => b.widgets));
      if (allWidgets.some((w) => w.type === widgetType)) return;
    }
    const newWidget: HeaderWidget = { id: `${widgetType}-${Date.now()}`, type: widgetType, config: {} };
    updateBlock(rowId, blockId, { widgets: [...block.widgets, newWidget] });
  };

  const removeWidget = (rowId: string, blockId: string, widgetId: string) => {
    const row = headerConfigDraft.rows.find((r) => r.id === rowId);
    if (!row) return;
    const block = row.blocks.find((b) => b.id === blockId);
    if (!block) return;
    updateBlock(rowId, blockId, { widgets: block.widgets.filter((w) => w.id !== widgetId) });
    if (selectedWidget?.widgetId === widgetId) setSelectedWidget(null);
  };

  const getUsedWidgetTypes = (): Set<HeaderWidgetType> => {
    const used = new Set<HeaderWidgetType>();
    headerConfigDraft.rows.forEach((row) => {
      row.blocks.forEach((block) => {
        block.widgets.forEach((widget) => {
          const meta = HEADER_WIDGET_LIBRARY[widget.type];
          if (!meta.allowMultiple) used.add(widget.type);
        });
      });
    });
    return used;
  };

  const usedWidgetTypes = getUsedWidgetTypes();

  return (
    <div className="space-y-4">
      {/* Status and Actions Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Draft has unpublished changes</span>
          ) : headerConfig.rows.length > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Published</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">No header configured</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges && headerConfig.rows.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onDraftChange(headerConfig)} className="text-xs text-slate-500">
              Revert to Published
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing || headerConfigDraft.rows.length === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPublishing ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</> : <><Send className="h-4 w-4" /> Publish</>}
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4">
        <div className={cn("flex-1 min-w-0", selectedWidget && "max-w-[calc(100%-320px)]")}>
          <AccordionGroup>
            <AccordionItem
              title="Row Configuration"
              description="Configure header rows, layout, and widgets"
              defaultOpen={true}
              badge={
                headerConfigDraft.rows.length > 0 ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    {headerConfigDraft.rows.filter((r) => r.enabled).length}/{headerConfigDraft.rows.length} rows
                  </span>
                ) : null
              }
            >
              <div className="space-y-4">
                {headerConfigDraft.rows.map((row, rowIndex) => (
                  <div key={row.id} className={cn("rounded-xl border-2 transition-colors", row.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50")}>
                    {/* Row Header */}
                    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                      <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={row.enabled} onChange={(e) => updateRow(row.id, { enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-[#009688] focus:ring-[#009688]" />
                        <span className="text-sm font-medium text-slate-700">Row {rowIndex + 1}</span>
                      </label>
                      <div className="flex-1" />
                      <select value={row.layout} onChange={(e) => changeLayout(row.id, e.target.value as RowLayout)} disabled={!row.enabled} className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-[#009688] focus:outline-none">
                        {LAYOUT_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                      <button type="button" onClick={() => updateRow(row.id, { fixed: !row.fixed })} disabled={!row.enabled} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors", row.fixed ? "bg-[#009688]/10 text-[#009688]" : "bg-slate-100 text-slate-500 hover:bg-slate-200")} title={row.fixed ? "Fixed/Sticky" : "Scrollable"}>
                        {row.fixed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        {row.fixed ? "Fixed" : "Scroll"}
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveRow(row.id, "up")} disabled={rowIndex === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"><ChevronUp className="h-4 w-4" /></button>
                        <button type="button" onClick={() => moveRow(row.id, "down")} disabled={rowIndex === headerConfigDraft.rows.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"><ChevronDown className="h-4 w-4" /></button>
                        <button type="button" onClick={() => deleteRow(row.id)} className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>

                    {/* Row Blocks */}
                    {row.enabled && (
                      <div className="p-4">
                        <div className="flex gap-2">
                          {row.blocks.map((block, blockIndex) => {
                            const widthPct = LAYOUT_WIDTHS[row.layout][blockIndex] || 100;
                            return (
                              <div key={block.id} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3" style={{ width: `${widthPct}%` }}>
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-medium text-slate-500">{widthPct}%</span>
                                  <div className="flex gap-1">
                                    {(["left", "center", "right"] as BlockAlignment[]).map((align) => (
                                      <button key={align} type="button" onClick={() => updateBlock(row.id, block.id, { alignment: align })} className={cn("rounded p-1 transition-colors", block.alignment === align ? "bg-[#009688]/20 text-[#009688]" : "text-slate-400 hover:bg-slate-200 hover:text-slate-600")} title={`Align ${align}`}>
                                        {align === "left" && <AlignLeft className="h-3 w-3" />}
                                        {align === "center" && <AlignCenter className="h-3 w-3" />}
                                        {align === "right" && <AlignRight className="h-3 w-3" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className={cn("flex flex-wrap gap-1 min-h-[40px]", block.alignment === "left" && "justify-start", block.alignment === "center" && "justify-center", block.alignment === "right" && "justify-end")}>
                                  {block.widgets.map((widget) => {
                                    const WidgetIcon = WIDGET_ICONS[widget.type];
                                    const widgetMeta = HEADER_WIDGET_LIBRARY[widget.type];
                                    const isSelected = selectedWidget?.rowId === row.id && selectedWidget?.blockId === block.id && selectedWidget?.widgetId === widget.id;
                                    return (
                                      <div key={widget.id} onClick={() => setSelectedWidget({ rowId: row.id, blockId: block.id, widgetId: widget.id })} className={cn("flex items-center gap-1 rounded-md border px-2 py-1 text-xs cursor-pointer transition-colors", isSelected ? "border-[#009688] bg-[#009688]/10 text-[#009688]" : "border-slate-200 bg-white text-slate-600 hover:border-[#009688]/50")}>
                                        <WidgetIcon className="h-3 w-3" />
                                        <span>{widgetMeta.label}</span>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); removeWidget(row.id, block.id, widget.id); }} className="ml-1 rounded text-slate-400 hover:text-rose-600"><Trash2 className="h-3 w-3" /></button>
                                      </div>
                                    );
                                  })}
                                  <WidgetAdder onAdd={(type) => addWidgetToBlock(row.id, block.id, type)} usedTypes={usedWidgetTypes} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-100">
                          <label className="text-xs text-slate-500">Background:</label>
                          <input type="color" value={row.backgroundColor || "#ffffff"} onChange={(e) => updateRow(row.id, { backgroundColor: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-slate-200" />
                          <input type="text" value={row.backgroundColor || ""} onChange={(e) => updateRow(row.id, { backgroundColor: e.target.value })} placeholder="#ffffff" className="w-24 rounded border border-slate-200 px-2 py-1 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button type="button" onClick={addRow} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-4 text-sm text-slate-500 transition-colors hover:border-[#009688] hover:text-[#009688]">
                  <Plus className="h-4 w-4" /> Add Row
                </button>
              </div>
            </AccordionItem>

            {/* Header Preview */}
            <AccordionItem
              title="Header Preview"
              description="Preview of your header configuration"
              defaultOpen={true}
              badge={
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  Preview
                </span>
              }
            >
              <div className="bg-slate-100 p-4">
                <div className="rounded-lg overflow-hidden shadow-lg bg-white">
                  {headerConfigDraft.rows.filter(r => r.enabled).map((row) => (
                    <div
                      key={row.id}
                      className="border-b border-slate-200 last:border-b-0"
                      style={{ backgroundColor: row.backgroundColor || "#ffffff" }}
                    >
                      <div className="mx-auto max-w-[1920px] px-4 flex items-center gap-2 py-3">
                        {row.blocks.map((block, blockIndex) => {
                          const widthPct = LAYOUT_WIDTHS[row.layout][blockIndex] || 100;
                          return (
                            <div
                              key={block.id}
                              className={cn(
                                "flex items-center gap-2 flex-wrap",
                                block.alignment === "left" && "justify-start",
                                block.alignment === "center" && "justify-center",
                                block.alignment === "right" && "justify-end"
                              )}
                              style={{ width: `${widthPct}%` }}
                            >
                              {block.widgets.map((widget) => {
                                const Icon = WIDGET_ICONS[widget.type];
                                const meta = HEADER_WIDGET_LIBRARY[widget.type];
                                const config = (widget.config || {}) as Record<string, unknown>;

                                if (widget.type === "logo") {
                                  return (
                                    <div key={widget.id} className="flex items-center gap-2 text-slate-600">
                                      <Image className="h-5 w-5" />
                                      <span className="font-semibold text-sm">Logo</span>
                                    </div>
                                  );
                                }

                                if (widget.type === "search-bar") {
                                  return (
                                    <div key={widget.id} className="flex-1 max-w-md">
                                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <Search className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm text-slate-400">{(config.placeholder as string) || "Search products..."}</span>
                                      </div>
                                    </div>
                                  );
                                }

                                if (widget.type === "button") {
                                  const label = (config.label as string) || "Button";
                                  const variant = (config.variant as string) || "outline";
                                  const customStyle: React.CSSProperties = {};
                                  if (config.backgroundColor) {
                                    customStyle.backgroundColor = config.backgroundColor as string;
                                  }
                                  if (config.textColor) {
                                    customStyle.color = config.textColor as string;
                                  } else if (row.backgroundColor && row.backgroundColor !== "#ffffff") {
                                    customStyle.color = row.textColor || "#ffffff";
                                  }
                                  return (
                                    <span
                                      key={widget.id}
                                      className={cn(
                                        "rounded-md px-3 py-1.5 text-xs font-medium",
                                        variant === "primary" && "bg-[#009688] text-white",
                                        variant === "secondary" && "bg-slate-100 text-slate-700",
                                        variant === "outline" && "border border-current/20 text-inherit",
                                        variant === "ghost" && "text-inherit opacity-90"
                                      )}
                                      style={customStyle}
                                    >
                                      {label}
                                    </span>
                                  );
                                }

                                if (widget.type === "category-menu") {
                                  const label = (config.label as string) || "Menu";
                                  return (
                                    <span
                                      key={widget.id}
                                      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700"
                                    >
                                      <Menu className="h-4 w-4" />
                                      {label}
                                    </span>
                                  );
                                }

                                if (widget.type === "radio-widget") {
                                  const radioConfig = config as { enabled?: boolean; headerIcon?: string };
                                  if (radioConfig.enabled === false) return null;
                                  return (
                                    <span key={widget.id} className="shrink-0" title="Radio Player">
                                      {radioConfig.headerIcon ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={radioConfig.headerIcon} alt="Radio" className="h-10 w-auto" />
                                      ) : (
                                        <Radio className="h-6 w-6 text-slate-600" />
                                      )}
                                    </span>
                                  );
                                }

                                // Icon widgets (cart, favorites, compare, profile, etc.)
                                return (
                                  <span
                                    key={widget.id}
                                    className="rounded-md p-2 text-slate-600"
                                    title={meta.label}
                                  >
                                    <Icon className="h-5 w-5" />
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {headerConfigDraft.rows.filter(r => r.enabled).length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-400">
                      No header rows enabled. Add and enable rows above to see a preview.
                    </div>
                  )}
                </div>
              </div>
            </AccordionItem>
          </AccordionGroup>
        </div>

        {/* Right Column - Widget Config Panel */}
        {selectedWidget && (
          <div className="w-80 shrink-0">
            <div className="sticky top-4">
              <WidgetConfigPanel headerConfig={headerConfigDraft} selectedWidget={selectedWidget} onUpdate={onDraftChange} onClose={() => setSelectedWidget(null)} channel={channel} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
