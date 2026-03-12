"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Search,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Session {
  session_id: string;
  user_email: string;
  user_role: string;
  company_name?: string;
  client_app: string;
  device_type: string;
  browser?: string;
  os?: string;
  ip_address: string;
  country?: string;
  city?: string;
  last_activity: string;
  created_at: string;
  expires_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/b2b/admin/sessions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.items);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadSessions();
  };

  const handleRevoke = async (sessionId: string) => {
    if (!confirm(t("pages.admin.sessions.confirmRevoke"))) return;

    setRevoking(sessionId);
    try {
      const res = await fetch(`/api/b2b/admin/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadSessions();
      }
    } catch (error) {
      console.error("Error revoking session:", error);
    } finally {
      setRevoking(null);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("pages.admin.sessions.now");
    if (diffMins < 60) return t("pages.admin.sessions.minutesAgo").replace("{n}", String(diffMins));
    if (diffHours < 24) return t("pages.admin.sessions.hoursAgo").replace("{n}", String(diffHours));
    if (diffDays === 1) return t("pages.admin.sessions.yesterday");
    return t("pages.admin.sessions.daysAgo").replace("{n}", String(diffDays));
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("pages.admin.sessions.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("pages.admin.sessions.subtitle")}
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("pages.admin.sessions.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t("pages.admin.sessions.noSessions")}</p>
        </div>
      ) : (
        <>
          {/* Sessions Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("pages.admin.sessions.user")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("pages.admin.sessions.app")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("pages.admin.sessions.device")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("pages.admin.sessions.location")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("pages.admin.sessions.lastActivity")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sessions.map((s) => (
                    <tr key={s.session_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {s.user_email}
                          </p>
                          <p className="text-xs text-slate-500">
                            {s.company_name || s.user_role}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {s.client_app}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(s.device_type)}
                          <div>
                            <p className="text-sm text-slate-900">
                              {s.browser || "Unknown"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {s.os || "Unknown OS"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm text-slate-900">
                              {s.city && s.country
                                ? `${s.city}, ${s.country}`
                                : s.country || "Unknown"}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {s.ip_address}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {formatTimeAgo(s.last_activity)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevoke(s.session_id)}
                          disabled={revoking === s.session_id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {revoking === s.session_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {t("pages.admin.sessions.revoke")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                {t("pages.admin.sessions.showingPagination")
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
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600">
                  {t("pages.admin.sessions.pageOf")
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
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
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
