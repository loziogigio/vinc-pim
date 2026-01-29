"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  FileText,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Pencil,
  BarChart3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  CAMPAIGN_STATUS_LABELS,
  type CampaignStatus,
} from "@/lib/constants/notification";

// ============================================
// TYPES
// ============================================

interface Campaign {
  campaign_id: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  type: "product" | "generic";
  title: string;
  channels: string[];
  recipient_type: "all" | "selected" | "tagged";
  recipient_count?: number;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

type StatusFilter = "all" | CampaignStatus;

type Props = {
  onEditDraft?: (campaignId: string) => void;
  onViewResults?: (campaignId: string) => void;
  onSelectCampaign?: (campaign: Campaign) => void;
};

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ status }: { status: CampaignStatus }) {
  const config: Record<CampaignStatus, { icon: typeof FileText; color: string; bg: string }> = {
    draft: { icon: FileText, color: "text-slate-600", bg: "bg-slate-100" },
    scheduled: { icon: Clock, color: "text-blue-600", bg: "bg-blue-100" },
    sending: { icon: Send, color: "text-amber-600", bg: "bg-amber-100" },
    sent: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
    failed: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-100" },
  };

  const { icon: Icon, color, bg } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color} ${bg}`}>
      <Icon className="w-3 h-3" />
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CampaignList({ onEditDraft, onViewResults, onSelectCampaign }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const limit = 10;

  // Load campaigns
  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(debouncedSearch && { search: debouncedSearch }),
      });

      const res = await fetch(`/api/b2b/notifications/campaigns?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error loading campaigns:", error);
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  // Delete campaign
  const handleDelete = async (campaignId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/b2b/notifications/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadCampaigns();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca campagna..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-1 flex-wrap">
          {(["all", "draft", "sent", "scheduled", "sending", "failed"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                statusFilter === status
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {status === "all" ? "Tutte" : CAMPAIGN_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-slate-500">Caricamento...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {searchQuery || statusFilter !== "all"
              ? "Nessuna campagna trovata"
              : "Nessuna campagna creata"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.campaign_id}
              className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition bg-white"
            >
              <div className="flex items-start gap-4">
                {/* Main Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectCampaign?.(campaign)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {campaign.name}
                    </h3>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="text-sm text-slate-600 truncate mb-2">
                    {campaign.title}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {campaign.sent_at
                        ? `Inviata: ${formatDate(campaign.sent_at)}`
                        : `Creata: ${formatDate(campaign.created_at)}`}
                    </span>
                    {campaign.recipient_count !== undefined && (
                      <span>
                        {campaign.recipient_count} destinatar{campaign.recipient_count !== 1 ? "i" : "io"}
                      </span>
                    )}
                    <span className="capitalize">
                      {campaign.channels.join(", ")}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {campaign.status === "draft" && onEditDraft && (
                    <button
                      onClick={() => onEditDraft(campaign.campaign_id)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-primary transition"
                      title="Modifica"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {(campaign.status === "sent" || campaign.status === "failed") && onViewResults && (
                    <button
                      onClick={() => onViewResults(campaign.campaign_id)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-600 transition"
                      title="Risultati"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  )}
                  {(campaign.status === "draft" || campaign.status === "failed") && (
                    <button
                      onClick={() => setDeleteConfirm(campaign.campaign_id)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-sm text-slate-500">
            {total} campagn{total !== 1 ? "e" : "a"} total{total !== 1 ? "i" : "e"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">
              Pagina {page} di {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Elimina campagna</h4>
                <p className="text-sm text-slate-500">
                  Questa azione non può essere annullata
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Sei sicuro di voler eliminare questa campagna? Tutti i dati associati verranno persi.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
