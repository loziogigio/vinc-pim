"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Layers, Loader2 } from "lucide-react";
import { CategorySelector } from "./CategorySelector";
import { useLanguageStore } from "@/lib/stores/languageStore";

interface ChannelOption {
  code: string;
  name: string;
  color?: string;
}

interface ChannelCategoryEntry {
  channel_code: string;
  category: any;
}

interface ChannelSectionProps {
  channels: string[];
  setChannels: (channels: string[]) => void;
  channelCategories: ChannelCategoryEntry[];
  setChannelCategories: (entries: ChannelCategoryEntry[]) => void;
  disabled?: boolean;
}

function getMultilingualText(
  text: string | Record<string, string> | undefined | null,
  langCode: string = "it",
  fallback: string = ""
): string {
  if (!text) return fallback;
  if (typeof text === "string") return text;
  return text[langCode] || text.it || text.en || Object.values(text)[0] || fallback;
}

export function ChannelSection({
  channels,
  setChannels,
  channelCategories,
  setChannelCategories,
  disabled = false,
}: ChannelSectionProps) {
  const [availableChannels, setAvailableChannels] = useState<ChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingChannelCategory, setAddingChannelCategory] = useState(false);
  const [newChannelCode, setNewChannelCode] = useState("");
  const { defaultLanguageCode } = useLanguageStore();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/b2b/channels");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAvailableChannels(data.channels ?? []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const toggleChannel = (code: string) => {
    if (disabled) return;
    if (channels.includes(code)) {
      // Don't allow removing "default"
      if (code === "default") return;
      setChannels(channels.filter((c) => c !== code));
    } else {
      setChannels([...channels, code]);
    }
  };

  const addChannelCategory = () => {
    if (!newChannelCode || disabled) return;
    // Don't add duplicate
    if (channelCategories.some((cc) => cc.channel_code === newChannelCode)) return;
    setChannelCategories([
      ...channelCategories,
      { channel_code: newChannelCode, category: null },
    ]);
    setAddingChannelCategory(false);
    setNewChannelCode("");
  };

  const removeChannelCategory = (channelCode: string) => {
    if (disabled) return;
    setChannelCategories(channelCategories.filter((cc) => cc.channel_code !== channelCode));
  };

  const updateChannelCategoryCategory = (channelCode: string, category: any) => {
    setChannelCategories(
      channelCategories.map((cc) =>
        cc.channel_code === channelCode ? { ...cc, category } : cc
      )
    );
  };

  // Channels not yet assigned a channel_category
  const usedChannelCodes = channelCategories.map((cc) => cc.channel_code);
  const availableForChannelCategory = availableChannels.filter(
    (ch) => !usedChannelCodes.includes(ch.code)
  );

  const getChannelName = (code: string) => {
    const ch = availableChannels.find((c) => c.code === code);
    return ch?.name || code;
  };

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5" /> Channels
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading channels...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Layers className="h-5 w-5" /> Channels
      </h3>

      {/* Active channels */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">
          Active channels for this product:
        </p>
        <div className="flex flex-wrap gap-2">
          {availableChannels.map((ch) => {
            const isActive = channels.includes(ch.code);
            const isDefault = ch.code === "default";
            return (
              <button
                key={ch.code}
                onClick={() => toggleChannel(ch.code)}
                disabled={disabled || isDefault}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-accent"
                } ${isDefault ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {ch.name}
                {isDefault && " (always)"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel-specific categories */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">
            Channel-specific categories
          </p>
          {!disabled && availableForChannelCategory.length > 0 && (
            <button
              onClick={() => setAddingChannelCategory(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Assign different category hierarchies per channel. Products can appear under different categories in B2B vs B2C.
        </p>

        {channelCategories.length === 0 && !addingChannelCategory && (
          <p className="text-xs text-muted-foreground italic">
            No channel-specific categories. The default category above is used for all channels.
          </p>
        )}

        {channelCategories.map((cc) => (
          <div
            key={cc.channel_code}
            className="border rounded-lg p-3 mb-3 bg-muted/30"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold">
                  {getChannelName(cc.channel_code)}
                </span>
                {cc.category && (
                  <span className="text-xs text-muted-foreground">
                    → {getMultilingualText(cc.category?.name, defaultLanguageCode, "No category")}
                  </span>
                )}
              </span>
              {!disabled && (
                <button
                  onClick={() => removeChannelCategory(cc.channel_code)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove channel category"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <CategorySelector
              value={cc.category || undefined}
              onChange={(cat) => updateChannelCategoryCategory(cc.channel_code, cat)}
              disabled={disabled}
            />
          </div>
        ))}

        {/* Add new channel category */}
        {addingChannelCategory && (
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <select
                value={newChannelCode}
                onChange={(e) => setNewChannelCode(e.target.value)}
                className="flex-1 px-3 py-1.5 border rounded text-sm bg-background"
              >
                <option value="">-- Select channel --</option>
                {availableForChannelCategory.map((ch) => (
                  <option key={ch.code} value={ch.code}>
                    {ch.name} ({ch.code})
                  </option>
                ))}
              </select>
              <button
                onClick={addChannelCategory}
                disabled={!newChannelCode}
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAddingChannelCategory(false);
                  setNewChannelCode("");
                }}
                className="px-3 py-1.5 text-xs rounded border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
