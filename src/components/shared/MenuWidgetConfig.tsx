"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { MenuDisplayMode } from "@/lib/types/home-settings";

interface SalesChannel {
  code: string;
  name: string;
  is_active: boolean;
}

export interface MenuWidgetConfigProps {
  config: { label?: string; channel?: string; displayMode?: MenuDisplayMode };
  onConfigChange: (updates: Record<string, unknown>) => void;
}

const DISPLAY_MODES: MenuDisplayMode[] = ["inline", "drawer"];

export function MenuWidgetConfig({
  config,
  onConfigChange,
}: MenuWidgetConfigProps) {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(true);

  const channel = config.channel || "";
  const displayMode: MenuDisplayMode = config.displayMode || "drawer";

  // Fetch available channels
  useEffect(() => {
    setLoadingChannels(true);
    fetch("/api/b2b/channels")
      .then((res) => (res.ok ? res.json() : { channels: [] }))
      .then((data) => setChannels(data.channels || []))
      .catch(() => setChannels([]))
      .finally(() => setLoadingChannels(false));
  }, []);

  // Fetch menu items for selected channel
  useEffect(() => {
    if (!channel) {
      setMenuItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/b2b/menu?location=header&channel=${encodeURIComponent(channel)}`)
      .then((res) => (res.ok ? res.json() : { menuItems: [] }))
      .then((data) => setMenuItems(data.menuItems || []))
      .catch(() => setMenuItems([]))
      .finally(() => setLoading(false));
  }, [channel]);

  const rootItems = menuItems.filter((item) => !item.parent_id);
  const hasMenu = rootItems.length > 0;

  return (
    <div className="space-y-3">
      {/* Channel selector */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Channel</label>
        {loadingChannels ? (
          <div className="mt-1 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading channels...</span>
          </div>
        ) : (
          <select
            value={channel}
            onChange={(e) => onConfigChange({ channel: e.target.value })}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Select a channel...</option>
            {channels.map((ch) => (
              <option key={ch.code} value={ch.code}>
                {ch.name} ({ch.code})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Label */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Label</label>
        <input
          type="text"
          value={config.label || ""}
          onChange={(e) => onConfigChange({ label: e.target.value })}
          placeholder="Menu"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {/* Display mode */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          {t("pages.homeSettings.widgets.displayMode")}
        </label>
        <div className="mt-1 inline-flex rounded-md border border-border p-0.5 bg-muted">
          {DISPLAY_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onConfigChange({ displayMode: mode })}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                displayMode === mode
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`pages.homeSettings.widgets.displayMode_${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Menu status for channel */}
      {channel && (
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">Linked Menu</span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
              {channel}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          ) : hasMenu ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="text-xs text-foreground">
                  {rootItems.length} root item{rootItems.length !== 1 ? "s" : ""} ({menuItems.length} total)
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {rootItems.slice(0, 8).map((item) => (
                  <span key={item.menu_item_id} className="rounded bg-card px-2 py-0.5 text-[11px] text-muted-foreground border border-border">
                    {item.label || item.reference_id || item.type}
                  </span>
                ))}
                {rootItems.length > 8 && (
                  <span className="text-[11px] text-muted-foreground">+{rootItems.length - 8} more</span>
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
              <div className="flex items-center gap-2 py-1 text-amber-600 dark:text-amber-400">
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
      )}
    </div>
  );
}
