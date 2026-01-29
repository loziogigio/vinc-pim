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
import { CHANNEL_LABELS, type NotificationChannel } from "@/lib/constants/notification";

// ============================================
// TYPES
// ============================================

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
    mobile?: ChannelResults;
    web_in_app?: ChannelResults;
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

const channelIcons: Record<NotificationChannel, typeof Mail> = {
  email: Mail,
  mobile: Smartphone,
  web_in_app: Bell,
};

const channelColors: Record<NotificationChannel, { bg: string; text: string; border: string }> = {
  email: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  mobile: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  web_in_app: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
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
  color = "text-slate-600",
}: {
  icon: typeof Send;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
    </div>
  );
}

// ============================================
// CHANNEL RESULTS CARD
// ============================================

function ChannelCard({
  channel,
  results,
}: {
  channel: NotificationChannel;
  results: ChannelResults;
}) {
  const Icon = channelIcons[channel];
  const colors = channelColors[channel];
  const total = results.sent + results.failed;
  const deliveryRate = total > 0 ? results.sent / total : 0;
  const openRate = results.opened !== undefined && results.sent > 0
    ? results.opened / results.sent
    : undefined;
  const clickRate = results.clicked !== undefined && results.sent > 0
    ? results.clicked / results.sent
    : undefined;
  const readRate = results.read !== undefined && results.sent > 0
    ? results.read / results.sent
    : undefined;

  return (
    <div className={`p-4 rounded-lg border ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <h3 className={`font-semibold ${colors.text}`}>
          {CHANNEL_LABELS[channel]}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Sent */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-1 text-emerald-600 mb-1">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-xs">Inviati</span>
          </div>
          <p className="text-lg font-bold text-slate-900">{results.sent}</p>
        </div>

        {/* Failed */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-1 text-rose-600 mb-1">
            <XCircle className="w-3 h-3" />
            <span className="text-xs">Falliti</span>
          </div>
          <p className="text-lg font-bold text-slate-900">{results.failed}</p>
        </div>

        {/* Delivery Rate */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-1 text-blue-600 mb-1">
            <Send className="w-3 h-3" />
            <span className="text-xs">Consegna</span>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {formatPercent(deliveryRate)}
          </p>
        </div>

        {/* Open/Read Rate */}
        {(openRate !== undefined || readRate !== undefined) && (
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center gap-1 text-amber-600 mb-1">
              <Eye className="w-3 h-3" />
              <span className="text-xs">{openRate !== undefined ? "Aperture" : "Letti"}</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {formatPercent(openRate ?? readRate ?? 0)}
            </p>
          </div>
        )}

        {/* Click Rate */}
        {clickRate !== undefined && (
          <div className="bg-white rounded-lg p-3 col-span-2">
            <div className="flex items-center gap-1 text-purple-600 mb-1">
              <MousePointerClick className="w-3 h-3" />
              <span className="text-xs">Click</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {formatPercent(clickRate)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CampaignResults({ campaignId, onBack }: Props) {
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
          setError(json.error || "Errore nel caricamento");
        }
      } catch (err) {
        console.error("Error loading results:", err);
        setError("Errore di connessione");
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
        <span className="text-sm text-slate-500">Caricamento risultati...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">{error || "Risultati non disponibili"}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 text-sm text-primary hover:underline"
          >
            Torna alla lista
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
            className="p-2 rounded-lg hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">{data.name}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            {data.sent_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Inviata: {formatDate(data.sent_at)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {data.recipient_count} destinatar{data.recipient_count !== 1 ? "i" : "io"}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Send}
          label="Totale Inviati"
          value={data.totals.sent}
          color="text-emerald-600"
        />
        <StatCard
          icon={XCircle}
          label="Totale Falliti"
          value={data.totals.failed}
          color="text-rose-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Tasso Consegna"
          value={formatPercent(data.totals.delivery_rate)}
          color="text-blue-600"
        />
        {data.totals.open_rate !== undefined && (
          <StatCard
            icon={Eye}
            label="Tasso Apertura"
            value={formatPercent(data.totals.open_rate)}
            color="text-amber-600"
          />
        )}
      </div>

      {/* Per-Channel Results */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Risultati per Canale
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.results.email && (
            <ChannelCard channel="email" results={data.results.email} />
          )}
          {data.results.mobile && (
            <ChannelCard channel="mobile" results={data.results.mobile} />
          )}
          {data.results.web_in_app && (
            <ChannelCard channel="web_in_app" results={data.results.web_in_app} />
          )}
        </div>
      </div>

      {/* No Results */}
      {!data.results.email && !data.results.mobile && !data.results.web_in_app && (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            Nessun risultato dettagliato disponibile
          </p>
        </div>
      )}
    </div>
  );
}
