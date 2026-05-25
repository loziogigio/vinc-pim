"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Ban,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
  X,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface BlockedIP {
  _id: string;
  ip_address: string;
  is_global: boolean;
  reason: string;
  description?: string;
  attempt_count?: number;
  blocked_at: string;
  blocked_by?: string;
  expires_at?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function BlockedIPsPage() {
  const { t } = useTranslation();

  const REASON_LABELS: Record<string, string> = {
    brute_force: t("pages.admin.blockedIps.bruteForce"),
    suspicious_activity: t("pages.admin.blockedIps.suspiciousActivity"),
    manual_block: t("pages.admin.blockedIps.manualBlock"),
    rate_limit_exceeded: t("pages.admin.blockedIps.rateLimitExceeded"),
    geo_restriction: t("pages.admin.blockedIps.geoRestriction"),
  };

  const EXPIRY_OPTIONS = [
    { value: 0, label: t("pages.admin.blockedIps.permanentOption") },
    { value: 1, label: t("pages.admin.blockedIps.oneHour") },
    { value: 24, label: t("pages.admin.blockedIps.twentyFourHours") },
    { value: 168, label: t("pages.admin.blockedIps.sevenDays") },
    { value: 720, label: t("pages.admin.blockedIps.thirtyDays") },
  ];

  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Add form state
  const [newIP, setNewIP] = useState("");
  const [newReason, setNewReason] = useState("manual_block");
  const [newDescription, setNewDescription] = useState("");
  const [newExpiryHours, setNewExpiryHours] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBlockedIPs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const res = await fetch(`/api/b2b/admin/blocked-ips?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBlockedIPs(data.items);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error loading blocked IPs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    loadBlockedIPs();
  }, [loadBlockedIPs]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsAdding(true);

    try {
      const res = await fetch("/api/b2b/admin/blocked-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip_address: newIP,
          reason: newReason,
          description: newDescription || undefined,
          expires_hours: newExpiryHours || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowAddModal(false);
        setNewIP("");
        setNewReason("manual_block");
        setNewDescription("");
        setNewExpiryHours(0);
        await loadBlockedIPs();
      } else {
        setFormError(data.error || t("pages.admin.blockedIps.blockError"));
      }
    } catch (error) {
      console.error("Error blocking IP:", error);
      setFormError(t("pages.admin.blockedIps.blockError"));
    } finally {
      setIsAdding(false);
    }
  };

  const handleUnblock = async (id: string) => {
    if (!confirm(t("pages.admin.blockedIps.confirmUnblock"))) return;

    setUnblocking(id);
    try {
      const res = await fetch(`/api/b2b/admin/blocked-ips/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadBlockedIPs();
      } else {
        const data = await res.json();
        alert(data.error || t("pages.admin.blockedIps.unblockError"));
      }
    } catch (error) {
      console.error("Error unblocking IP:", error);
    } finally {
      setUnblocking(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.admin.blockedIps.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pages.admin.blockedIps.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("pages.admin.blockedIps.blockIP")}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : blockedIPs.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Ban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("pages.admin.blockedIps.noBlockedIPs")}</p>
        </div>
      ) : (
        <>
          {/* Blocked IPs Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.blockedIps.ipAddress")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.blockedIps.reason")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.blockedIps.blocked")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.blockedIps.expiry")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blockedIPs.map((ip) => (
                    <tr key={ip._id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium text-foreground">
                            {ip.ip_address}
                          </span>
                          {ip.is_global && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40 rounded-full">
                              <Globe className="w-3 h-3" />
                              {t("pages.admin.blockedIps.global")}
                            </span>
                          )}
                        </div>
                        {ip.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {ip.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40 rounded-full">
                          {REASON_LABELS[ip.reason] || ip.reason}
                        </span>
                        {ip.attempt_count && ip.attempt_count > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {ip.attempt_count} {t("pages.admin.blockedIps.attempts")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(ip.blocked_at)}
                          </p>
                          {ip.blocked_by && (
                            <p className="text-xs text-muted-foreground">
                              {t("pages.admin.blockedIps.by")} {ip.blocked_by}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {ip.expires_at ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {formatDate(ip.expires_at)}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("pages.admin.blockedIps.permanent")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ip.is_global ? (
                          <span className="text-xs text-muted-foreground">
                            {t("pages.admin.blockedIps.notEditable")}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleUnblock(ip._id)}
                            disabled={unblocking === ip._id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {unblocking === ip._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            {t("pages.admin.blockedIps.unblock")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <p className="text-sm text-muted-foreground">
                {t("pages.admin.blockedIps.showingPagination")
                  .replace("{from}", String((pagination.page - 1) * pagination.limit + 1))
                  .replace("{to}", String(Math.min(pagination.page * pagination.limit, pagination.total)))
                  .replace("{total}", String(pagination.total))}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page - 1,
                    }))
                  }
                  disabled={pagination.page === 1}
                  className="p-2 rounded-lg border border-border hover:bg-muted/50 disabled:opacity-50 disabled:hover:bg-card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground">
                  {t("pages.admin.blockedIps.pageOf")
                    .replace("{page}", String(pagination.page))
                    .replace("{pages}", String(pagination.totalPages))}
                </span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: prev.page + 1,
                    }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-muted/50 disabled:opacity-50 disabled:hover:bg-card"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">{t("pages.admin.blockedIps.modalTitle")}</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-4 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 text-sm rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("pages.admin.blockedIps.ipAddressLabel")}
                </label>
                <input
                  type="text"
                  value={newIP}
                  onChange={(e) => setNewIP(e.target.value)}
                  placeholder="192.168.1.1"
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("pages.admin.blockedIps.reasonLabel")}
                </label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="manual_block">{t("pages.admin.blockedIps.manualBlock")}</option>
                  <option value="brute_force">{t("pages.admin.blockedIps.bruteForce")}</option>
                  <option value="suspicious_activity">{t("pages.admin.blockedIps.suspiciousActivity")}</option>
                  <option value="rate_limit_exceeded">{t("pages.admin.blockedIps.rateLimitExceeded")}</option>
                  <option value="geo_restriction">{t("pages.admin.blockedIps.geoRestriction")}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("pages.admin.blockedIps.descriptionLabel")}
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t("pages.admin.blockedIps.descriptionPlaceholder")}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("pages.admin.blockedIps.blockDuration")}
                </label>
                <select
                  value={newExpiryHours}
                  onChange={(e) => setNewExpiryHours(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50"
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  {t("pages.admin.blockedIps.block")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
