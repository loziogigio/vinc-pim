"use client";

import { useEffect, useState, useCallback } from "react";
import {
  History,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Filter,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface LoginAttempt {
  _id: string;
  email: string;
  ip_address: string;
  success: boolean;
  failure_reason?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  country?: string;
  city?: string;
  client_id?: string;
  timestamp: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function LoginAttemptsPage() {
  const { t } = useTranslation();

  const FAILURE_REASON_LABELS: Record<string, string> = {
    invalid_credentials: t("pages.admin.loginAttempts.invalidCredentials"),
    user_not_found: t("pages.admin.loginAttempts.userNotFound"),
    user_blocked: t("pages.admin.loginAttempts.userBlocked"),
    tenant_blocked: t("pages.admin.loginAttempts.tenantBlocked"),
    ip_blocked: t("pages.admin.loginAttempts.ipBlocked"),
    rate_limited: t("pages.admin.loginAttempts.rateLimited"),
    mfa_failed: t("pages.admin.loginAttempts.mfaFailed"),
    expired_password: t("pages.admin.loginAttempts.expiredPassword"),
    account_locked: t("pages.admin.loginAttempts.accountLocked"),
  };
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "success" | "failed">("");
  const [isLoading, setIsLoading] = useState(true);

  const loadAttempts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/b2b/admin/login-attempts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAttempts(data.items);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error loading login attempts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter]);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("pages.admin.loginAttempts.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("pages.admin.loginAttempts.subtitle")}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 min-w-0">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("pages.admin.loginAttempts.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "" | "success" | "failed");
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{t("pages.admin.loginAttempts.all")}</option>
            <option value="success">{t("pages.admin.loginAttempts.successful")}</option>
            <option value="failed">{t("pages.admin.loginAttempts.failed")}</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("pages.admin.loginAttempts.noAttempts")}</p>
        </div>
      ) : (
        <>
          {/* Attempts Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.loginAttempts.dateTime")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.loginAttempts.email")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.loginAttempts.status")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.loginAttempts.ipLocation")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.loginAttempts.device")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("pages.admin.loginAttempts.client")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attempts.map((a) => (
                    <tr key={a._id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(a.timestamp)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground">
                          {a.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.success ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            {t("pages.admin.loginAttempts.success")}
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40 rounded-full">
                              <XCircle className="w-3 h-3" />
                              {t("pages.admin.loginAttempts.failure")}
                            </span>
                            {a.failure_reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {FAILURE_REASON_LABELS[a.failure_reason] ||
                                  a.failure_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-foreground font-mono">
                              {a.ip_address}
                            </p>
                            {(a.city || a.country) && (
                              <p className="text-xs text-muted-foreground">
                                {a.city && a.country
                                  ? `${a.city}, ${a.country}`
                                  : a.country}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(a.device_type)}
                          <div>
                            <p className="text-sm text-foreground">
                              {a.browser || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {a.os || "Unknown OS"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {a.client_id || "-"}
                        </span>
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
                {t("pages.admin.loginAttempts.showingPagination")
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
                  {t("pages.admin.loginAttempts.pageOf")
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
    </div>
  );
}
