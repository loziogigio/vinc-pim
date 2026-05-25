"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Smartphone,
  Bell,
  CheckCircle2,
  XCircle,
  Eye,
  MousePointerClick,
  Send,
  Loader2,
  ArrowLeft,
  Calendar,
  Users,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { NotificationChannel } from "@/lib/constants/notification";

// ============================================
// TYPES
// ============================================

// Display channels for results view
type DisplayChannel = "email" | "mobile_app" | "web";

interface ChannelResults {
  sent: number;
  failed: number;
  opened?: number;
  clicked?: number;
  read?: number;
}

interface CampaignResultsData {
  campaign_id: string;
  name: string;
  status: string;
  sent_at?: string;
  recipient_count: number;
  channels: NotificationChannel[];
  results: {
    email?: ChannelResults;
    mobile_app?: ChannelResults;
    web?: ChannelResults;
  };
  totals: {
    sent: number;
    failed: number;
    delivery_rate: number;
    open_rate?: number;
    click_rate?: number;
  };
}

type Props = {
  campaignId: string;
  onBack?: () => void;
};

// ============================================
// HELPERS
// ============================================

// Display channel labels for results view
const DISPLAY_CHANNEL_LABELS: Record<DisplayChannel, string> = {
  email: "Email",
  mobile_app: "Mobile App",
  web: "Web",
};

const channelIcons: Record<DisplayChannel, typeof Mail> = {
  email: Mail,
  mobile_app: Smartphone,
  web: Bell,
};

const channelColors: Record<DisplayChannel, { bg: string; text: string; border: string }> = {
  email: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  mobile_app: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-600 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  web: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// STAT CARD
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "text-muted-foreground",
}: {
  icon: typeof Send;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
    </div>
  );
}

// ============================================
// CHANNEL RESULTS CARD
// ============================================

function ChannelCard({
  channel,
  results,
  t,
}: {
  channel: DisplayChannel;
  results: ChannelResults;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const Icon = channelIcons[channel];
  const colors = channelColors[channel];
  const total = results.sent + results.failed;
  const deliveryRate = total > 0 ? results.sent / total : 0;

  // Unified metrics: use opened count, or read count as fallback for in-app
  // Rate is capped at 100% (1.0) for display - counts can exceed sent due to multiple opens/clicks
  const openCount = results.opened ?? results.read ?? 0;
  const openRate = results.sent > 0 ? Math.min(openCount / results.sent, 1) : 0;

  // Click rate - always show (capped at 100%)
  const clickCount = results.clicked ?? 0;
  const clickRate = results.sent > 0 ? Math.min(clickCount / results.sent, 1) : 0;

  return (
    <div className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <h3 className={`font-semibold ${colors.text}`}>
          {DISPLAY_CHANNEL_LABELS[channel]}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Sent */}
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-xs">{t("pages.notifications.campaigns.results.channelSent")}</span>
          </div>
          <p className="text-lg font-bold text-foreground">{results.sent}</p>
        </div>

        {/* Failed */}
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 mb-1">
            <XCircle className="w-3 h-3" />
            <span className="text-xs">{t("pages.notifications.campaigns.results.channelFailed")}</span>
          </div>
          <p className="text-lg font-bold text-foreground">{results.failed}</p>
        </div>

        {/* Delivery Rate */}
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
            <Send className="w-3 h-3" />
            <span className="text-xs">{t("pages.notifications.campaigns.results.channelDelivery")}</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatPercent(deliveryRate)}
          </p>
        </div>

        {/* Open Rate - always show */}
        <div className="bg-card rounded-lg p-3 border border-border/50">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 mb-1">
            <Eye className="w-3 h-3" />
            <span className="text-xs">{t("pages.notifications.campaigns.results.channelOpens")}</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatPercent(openRate)}
          </p>
        </div>

        {/* Click Rate - always show */}
        <div className="bg-card rounded-lg p-3 border border-border/50 col-span-2">
          <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
            <MousePointerClick className="w-3 h-3" />
            <span className="text-xs">{t("pages.notifications.campaigns.results.channelClicks")}</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {formatPercent(clickRate)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CampaignResults({ campaignId, onBack }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<CampaignResultsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResults() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/b2b/notifications/campaigns/${campaignId}/results`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          const json = await res.json();
          setError(json.error || t("pages.notifications.campaigns.results.loadError"));
        }
      } catch (err) {
        console.error("Error loading results:", err);
        setError(t("pages.notifications.campaigns.results.connectionError"));
      } finally {
        setIsLoading(false);
      }
    }
    loadResults();
  }, [campaignId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">{t("pages.notifications.campaigns.results.loadingResults")}</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{error || t("pages.notifications.campaigns.results.resultsUnavailable")}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 text-sm text-primary hover:underline"
          >
            {t("pages.notifications.campaigns.results.backToList")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{data.name}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            {data.sent_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {t("pages.notifications.campaigns.results.sentLabel", { date: formatDate(data.sent_at) })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {data.recipient_count !== 1
                ? t("pages.notifications.campaigns.results.recipientsPlural", { count: data.recipient_count })
                : t("pages.notifications.campaigns.results.recipientsSingular", { count: data.recipient_count })}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Send}
          label={t("pages.notifications.campaigns.results.totalSent")}
          value={data.totals.sent}
          color="text-emerald-600"
        />
        <StatCard
          icon={XCircle}
          label={t("pages.notifications.campaigns.results.totalFailed")}
          value={data.totals.failed}
          color="text-rose-600"
        />
        <StatCard
          icon={CheckCircle2}
          label={t("pages.notifications.campaigns.results.deliveryRate")}
          value={formatPercent(data.totals.delivery_rate)}
          color="text-blue-600"
        />
        {data.totals.open_rate !== undefined && (
          <StatCard
            icon={Eye}
            label={t("pages.notifications.campaigns.results.openRate")}
            value={formatPercent(data.totals.open_rate)}
            color="text-amber-600"
          />
        )}
      </div>

      {/* Per-Channel Results */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t("pages.notifications.campaigns.results.resultsByChannel")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.results.email && (
            <ChannelCard channel="email" results={data.results.email} t={t} />
          )}
          {data.results.mobile_app && (
            <ChannelCard channel="mobile_app" results={data.results.mobile_app} t={t} />
          )}
          {data.results.web && (
            <ChannelCard channel="web" results={data.results.web} t={t} />
          )}
        </div>
      </div>

      {/* No Results */}
      {!data.results.email && !data.results.mobile_app && !data.results.web && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("pages.notifications.campaigns.results.noDetailedResults")}
          </p>
        </div>
      )}
    </div>
  );
}
