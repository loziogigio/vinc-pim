"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Smartphone,
  Trash2,
  RefreshCw,
  User,
  CheckCircle,
  XCircle,
  MonitorSmartphone,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface FCMDevice {
  _id: string;
  token_id: string;
  user_id?: string;
  user_type?: "portal_user" | "b2b_user";
  platform: "ios" | "android";
  device_id?: string;
  device_model?: string;
  app_version?: string;
  os_version?: string;
  is_active: boolean;
  failure_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
  user_info?: {
    id?: string;
    username?: string;
    email?: string;
  };
}

interface DevicesResponse {
  devices: FCMDevice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    active: number;
    android: number;
    ios: number;
  };
}

export default function DevicesPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<FCMDevice[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, android: 0, ios: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const limit = 20;

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set("search", search);
      if (platformFilter) params.set("platform", platformFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/b2b/fcm/devices?${params}`);
      if (!res.ok) throw new Error("Failed to load devices");

      const data: DevicesResponse = await res.json();
      setDevices(data.devices);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
      setStats(data.stats);
    } catch (error) {
      console.error("Error loading devices:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, platformFilter, statusFilter]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleDelete = async (tokenId: string) => {
    if (!confirm(t("pages.notifications.devices.confirmRemove"))) return;

    setDeletingIds((prev) => new Set(prev).add(tokenId));
    try {
      const res = await fetch(`/api/b2b/fcm/devices?token_id=${tokenId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete device");
      }
      await loadDevices();
    } catch (error) {
      console.error("Error deleting device:", error);
      alert(error instanceof Error ? error.message : "Failed to delete device");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(tokenId);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Breadcrumbs items={[
          { label: t("pages.notifications.dashboard.breadcrumb"), href: "/b2b/notifications" },
          { label: t("pages.notifications.devices.title") },
        ]} />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("pages.notifications.devices.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("pages.notifications.devices.subtitle")}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t("pages.notifications.devices.totalDevices")}
          value={stats.total}
          icon={MonitorSmartphone}
          color="slate"
        />
        <StatCard
          label={t("common.active")}
          value={stats.active}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          label="Android"
          value={stats.android}
          icon={Smartphone}
          color="green"
        />
        <StatCard
          label="iOS"
          value={stats.ios}
          icon={Smartphone}
          color="blue"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pages.notifications.devices.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-foreground"
          />
        </div>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-foreground"
        >
          <option value="">{t("pages.notifications.devices.allPlatforms")}</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background text-foreground"
        >
          <option value="">{t("pages.notifications.devices.allStatuses")}</option>
          <option value="active">{t("common.active")}</option>
          <option value="inactive">{t("common.inactive")}</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadDevices()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Devices Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12">
            <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("pages.notifications.devices.noDevices")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("pages.notifications.devices.noDevicesSub")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.devices.device")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.devices.user")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.devices.platform")}
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("common.status")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.devices.registered")}
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.map((device) => (
                <tr key={device._id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {device.device_model || t("pages.notifications.devices.unknownDevice")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {device.device_id ? `ID: ${device.device_id.slice(0, 12)}...` : t("pages.notifications.devices.noDeviceId")}
                      </p>
                      {device.app_version && (
                        <p className="text-xs text-muted-foreground">
                          App v{device.app_version} {device.os_version && `/ OS ${device.os_version}`}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {device.user_info ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {device.user_info.username || device.user_id}
                          </p>
                          {device.user_info.email && (
                            <Link
                              href={`/b2b/store/portal-users/${device.user_info.id || device.user_id}`}
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              {device.user_info.email}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {device.user_type === "portal_user" ? t("pages.notifications.devices.portalUser") : t("pages.notifications.devices.b2bUser")}
                          </p>
                        </div>
                      </div>
                    ) : device.user_id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <Link
                            href={`/b2b/store/portal-users/${device.user_id}`}
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            {device.user_id}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {device.user_type === "portal_user" ? t("pages.notifications.devices.portalUser") : t("pages.notifications.devices.b2bUser")}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">{t("pages.notifications.devices.anonymousDevice")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PlatformBadge platform={device.platform} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge isActive={device.is_active} failureCount={device.failure_count} t={t} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(device.created_at)}
                    {device.last_used_at && (
                      <p className="text-xs text-muted-foreground">
                        {t("pages.notifications.devices.lastUsed").replace("{date}", formatDate(device.last_used_at))}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => handleDelete(device.token_id)}
                      disabled={deletingIds.has(device.token_id)}
                    >
                      {deletingIds.has(device.token_id) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      {t("pages.notifications.devices.remove")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between mt-4 gap-2">
          <p className="text-sm text-muted-foreground">
            {t("pages.notifications.devices.showing")
              .replace("{from}", String((page - 1) * limit + 1))
              .replace("{to}", String(Math.min(page * limit, total)))
              .replace("{total}", String(total))}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("pages.notifications.devices.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("pages.notifications.devices.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "slate" | "emerald" | "green" | "blue";
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    slate: "bg-muted border-border text-muted-foreground",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400",
    green: "bg-green-50 border-green-200 text-green-600 dark:bg-green-950/40 dark:border-green-800 dark:text-green-400",
    blue: "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400",
  };

  return (
    <div className={cn("p-4 rounded-xl border", colorClasses[color])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: "ios" | "android" }) {
  const config = {
    android: {
      label: "Android",
      className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    },
    ios: {
      label: "iOS",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    },
  }[platform];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
        config.className
      )}
    >
      <Smartphone className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StatusBadge({ isActive, failureCount, t }: { isActive: boolean; failureCount: number; t: (key: string) => string }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
        <XCircle className="w-3 h-3" />
        {t("common.inactive")}
        {failureCount > 0 && <span>({t("pages.notifications.devices.failures").replace("{count}", String(failureCount))})</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      <CheckCircle className="w-3 h-3" />
      {t("common.active")}
    </span>
  );
}
