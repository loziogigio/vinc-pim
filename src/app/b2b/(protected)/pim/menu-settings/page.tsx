"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { MenuBuilder } from "@/components/menu/menu-builder";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ChannelOption {
  code: string;
  name: string;
  color?: string;
  is_default?: boolean;
}

export default function MenuSettingsPage() {
  const [activeLocation, setActiveLocation] = useState<"header" | "footer" | "mobile">("header");
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("default");
  const [loadingChannels, setLoadingChannels] = useState(true);

  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch("/api/b2b/channels");
        if (res.ok) {
          const data = await res.json();
          const list: ChannelOption[] = data.channels ?? [];
          setChannels(list);
          const def = list.find((ch) => ch.is_default);
          if (def) setSelectedChannel(def.code);
          else if (list.length > 0) setSelectedChannel(list[0].code);
        }
      } catch {
        // channels will remain empty
      } finally {
        setLoadingChannels(false);
      }
    }
    fetchChannels();
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Product Information Management", href: "/b2b/pim" },
          { label: "Menu Settings" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Menu Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure your navigation menus with drag-and-drop. Add items from
          collections, categories, brands, and more.
        </p>
      </div>

      {/* Channel Selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Channel
        </label>
        {loadingChannels ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading channels...
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {channels.map((ch) => (
              <button
                key={ch.code}
                type="button"
                onClick={() => setSelectedChannel(ch.code)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                  selectedChannel === ch.code
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {ch.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Location Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveLocation("header")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "header"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Header Menu
        </button>
        <button
          onClick={() => setActiveLocation("footer")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "footer"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Footer Menu
        </button>
        <button
          onClick={() => setActiveLocation("mobile")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "mobile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mobile Menu
        </button>
      </div>

      {/* Menu Builder */}
      <MenuBuilder
        key={`${selectedChannel}-${activeLocation}`}
        location={activeLocation}
        channel={selectedChannel}
        channelName={channels.find((ch) => ch.code === selectedChannel)?.name || selectedChannel}
      />
    </div>
  );
}
