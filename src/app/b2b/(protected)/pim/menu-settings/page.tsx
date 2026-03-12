"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { MenuBuilder } from "@/components/menu/menu-builder";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ChannelOption {
  code: string;
  name: string;
  color?: string;
  is_default?: boolean;
}

export default function MenuSettingsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const channelParam = searchParams.get("channel");

  const [activeLocation, setActiveLocation] = useState<"header" | "footer" | "mobile">("header");
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>(channelParam || "default");
  const [loadingChannels, setLoadingChannels] = useState(true);

  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch("/api/b2b/channels");
        if (res.ok) {
          const data = await res.json();
          const list: ChannelOption[] = data.channels ?? [];
          setChannels(list);
          // If channel param matches, use it; otherwise fall back to default
          if (channelParam && list.some((ch) => ch.code === channelParam)) {
            setSelectedChannel(channelParam);
          } else {
            const def = list.find((ch) => ch.is_default);
            if (def) setSelectedChannel(def.code);
            else if (list.length > 0) setSelectedChannel(list[0].code);
          }
        }
      } catch {
        // channels will remain empty
      } finally {
        setLoadingChannels(false);
      }
    }
    fetchChannels();
  }, [channelParam]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pages.pim.breadcrumbPim"), href: "/b2b/pim" },
          { label: t("pages.pim.menuSettings.title") },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{t("pages.pim.menuSettings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pages.pim.menuSettings.subtitle")}
        </p>
      </div>

      {/* Channel Selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {t("pages.pim.menuSettings.channel")}
        </label>
        {loadingChannels ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("pages.pim.menuSettings.loadingChannels")}
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
          {t("pages.pim.menuSettings.headerMenu")}
        </button>
        <button
          onClick={() => setActiveLocation("footer")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "footer"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("pages.pim.menuSettings.footerMenu")}
        </button>
        <button
          onClick={() => setActiveLocation("mobile")}
          className={`px-4 py-2 font-medium transition border-b-2 ${
            activeLocation === "mobile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("pages.pim.menuSettings.mobileMenu")}
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
