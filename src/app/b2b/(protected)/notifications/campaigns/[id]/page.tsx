"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { CampaignResults } from "@/components/notifications/CampaignResults";
import type { CampaignStatus, TemplateType, NotificationChannel, RecipientType } from "@/lib/constants/notification";

interface Campaign {
  campaign_id: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  type: TemplateType;
  title: string;
  body: string;
  channels: NotificationChannel[];
  recipient_type: RecipientType;
  recipient_count?: number;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCampaign = useCallback(async () => {
    if (!campaignId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/b2b/notifications/campaigns/${campaignId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Campagna non trovata");
        } else {
          setError("Errore nel caricamento della campagna");
        }
        return;
      }

      const data = await res.json();
      setCampaign(data.campaign);
    } catch (err) {
      console.error("Error loading campaign:", err);
      setError("Errore nel caricamento della campagna");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleBack = () => {
    router.push("/b2b/notifications/campaigns");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-slate-500">Caricamento...</span>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Breadcrumbs items={[
            { label: "Notifiche", href: "/b2b/notifications" },
            { label: "Campagne", href: "/b2b/notifications/campaigns" },
            { label: campaignId },
          ]} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{error || "Campagna non trovata"}</p>
            <Button variant="outline" onClick={handleBack} className="mt-4 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Torna alle campagne
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Breadcrumbs items={[
          { label: "Notifiche", href: "/b2b/notifications" },
          { label: "Campagne", href: "/b2b/notifications/campaigns" },
          { label: campaign.name },
        ]} />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{campaign.title}</p>
          </div>
          <Button variant="outline" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Torna alle campagne
          </Button>
        </div>

        {/* ID and Slug */}
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => copyToClipboard(campaign.campaign_id, "id")}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-mono text-slate-600 transition"
            title="Copia ID"
          >
            {copiedId === "id" ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {campaign.campaign_id}
          </button>
          {campaign.slug && (
            <button
              onClick={() => copyToClipboard(campaign.slug, "slug")}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-xs font-mono text-primary transition"
              title="Copia Slug"
            >
              {copiedId === "slug" ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              /{campaign.slug}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {campaign.status === "sent" || campaign.status === "failed" || campaign.status === "sending" ? (
          <CampaignResults campaignId={campaign.campaign_id} />
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              Questa campagna non ha ancora risultati
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Stato attuale: {campaign.status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
