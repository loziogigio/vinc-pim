"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import type { IPortalUser } from "@/lib/types/portal-user";
import {
  Search,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Edit,
  Plus,
  Users,
  X,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  KeyRound,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { CreatePortalUserModal } from "./CreatePortalUserModal";

type PortalUserWithDetails = IPortalUser & {
  customer_count?: number;
};

interface PortalUserStats {
  total: number;
  active: number;
  inactive: number;
  with_access: number;
  never_logged_in: number;
}

export default function PortalUsersListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [portalUsers, setPortalUsers] = useState<PortalUserWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<PortalUserStats>({
    total: 0,
    active: 0,
    inactive: 0,
    with_access: 0,
    never_logged_in: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [searchFilter, setSearchFilter] = useState(searchParams?.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("is_active") || "");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchPortalUsers();
  }, [searchParams]);

  async function fetchPortalUsers() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "20");

      if (searchFilter) params.set("search", searchFilter);
      if (statusFilter) params.set("is_active", statusFilter);

      const res = await fetch(`/api/b2b/portal-users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPortalUsers(data.portal_users || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching portal users:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilters(updates: { search?: string; is_active?: string }) {
    const params = new URLSearchParams();
    const newSearch = updates.search !== undefined ? updates.search : searchFilter;
    const newStatus = updates.is_active !== undefined ? updates.is_active : statusFilter;

    if (newSearch) params.set("search", newSearch);
    if (newStatus) params.set("is_active", newStatus);
    params.set("page", "1");

    setSearchFilter(newSearch);
    setStatusFilter(newStatus);

    router.push(`${tenantPrefix}/b2b/store/portal-users?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", page.toString());
    router.push(`${tenantPrefix}/b2b/store/portal-users?${params.toString()}`);
  }

  async function handleToggleActive(user: PortalUserWithDetails) {
    setTogglingUserId(user.portal_user_id);
    try {
      const res = await fetch(`/api/b2b/portal-users/${user.portal_user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: !user.is_active,
        }),
      });

      if (res.ok) {
        // Update local state
        setPortalUsers((prev) =>
          prev.map((u) =>
            u.portal_user_id === user.portal_user_id
              ? { ...u, is_active: !u.is_active }
              : u
          )
        );
      } else {
        const data = await res.json();
        console.error("Failed to toggle user status:", data.error);
      }
    } catch (err) {
      console.error("Error toggling user status:", err);
    } finally {
      setTogglingUserId(null);
    }
  }

  const getAccessSummary = (access: ICustomerAccess[]) => {
    if (!access || access.length === 0) return t("pages.store.portalUsers.noAccess");
    if (access.length === 1) return t("pages.store.portalUsers.oneCustomer");
    return t("pages.store.portalUsers.nCustomers").replace("{n}", String(access.length));
  };

  const renderEmptyState = () => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-foreground">
        <UserCog className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-[1.05rem] font-semibold">{t("pages.store.portalUsers.noPortalUsersFound")}</p>
        <p className="mt-1 text-[0.85rem] text-muted-foreground">
          {searchFilter || statusFilter
            ? t("pages.store.portalUsers.tryAdjustingFilters")
            : t("pages.store.portalUsers.createFirstUser")}
        </p>
        {!searchFilter && !statusFilter && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            {t("pages.store.portalUsers.createPortalUser")}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pages.store.portalUsers.title"), href: "/b2b/store/portal-users" },
          { label: t("pages.store.portalUsers.title") },
        ]}
      />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{t("pages.store.portalUsers.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("pages.store.portalUsers.subtitle")} ({pagination.total} {t("pages.store.portalUsers.totalSuffix")})
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          {t("pages.store.portalUsers.newPortalUser")}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-lg bg-card p-4 shadow-sm border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t("pages.store.portalUsers.totalUsers")}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-card p-4 shadow-sm border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.active}</p>
              <p className="text-xs text-muted-foreground">{t("pages.store.portalUsers.active")}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-card p-4 shadow-sm border-l-4 border-l-gray-400">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted text-muted-foreground">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.inactive}</p>
              <p className="text-xs text-muted-foreground">{t("pages.store.portalUsers.inactive")}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-card p-4 shadow-sm border-l-4 border-l-purple-500">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.with_access}</p>
              <p className="text-xs text-muted-foreground">{t("pages.store.portalUsers.withAccess")}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-card p-4 shadow-sm border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.never_logged_in}</p>
              <p className="text-xs text-muted-foreground">{t("pages.store.portalUsers.neverLoggedIn")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("pages.store.portalUsers.searchPlaceholder")}
              value={searchFilter}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full rounded border border-border bg-background px-9 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => updateFilters({ is_active: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">{t("pages.store.portalUsers.allStatus")}</option>
            <option value="true">{t("pages.store.portalUsers.active")}</option>
            <option value="false">{t("pages.store.portalUsers.inactive")}</option>
          </select>
        </div>

        {/* Active Filters */}
        {(searchFilter || statusFilter) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{t("pages.store.portalUsers.activeFilters")}</span>
            {statusFilter && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>{statusFilter === "true" ? t("pages.store.portalUsers.active") : t("pages.store.portalUsers.inactive")}</span>
                <button
                  onClick={() => updateFilters({ is_active: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {searchFilter && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>{t("common.search")}: &quot;{searchFilter}&quot;</span>
                <button
                  onClick={() => updateFilters({ search: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={() => updateFilters({ search: "", is_active: "" })}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {t("pages.store.portalUsers.clearAll")}
            </button>
          </div>
        )}
      </div>

      {/* Portal Users Table */}
      <div className="rounded-lg bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        ) : portalUsers.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      {t("pages.store.portalUsers.user")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      {t("pages.store.portalUsers.email")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      {t("pages.store.portalUsers.status")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      {t("pages.store.portalUsers.customerAccess")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      {t("pages.store.portalUsers.lastLogin")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      {t("pages.store.portalUsers.created")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {portalUsers.map((user) => (
                    <tr key={user.portal_user_id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                            <UserCog className="h-4 w-4" />
                          </div>
                          <div>
                            <Link
                              href={`${tenantPrefix}/b2b/store/portal-users/${user.portal_user_id}`}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {user.username}
                            </Link>
                            <div className="text-xs text-muted-foreground font-mono">
                              {user.portal_user_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{user.email}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={togglingUserId === user.portal_user_id}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                            user.is_active
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          } ${togglingUserId === user.portal_user_id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                          title={user.is_active ? t("pages.store.portalUsers.clickToDeactivate") : t("pages.store.portalUsers.clickToActivate")}
                        >
                          {togglingUserId === user.portal_user_id ? (
                            <>
                              <span className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full"></span>
                              {user.is_active ? t("common.active") : t("common.inactive")}
                            </>
                          ) : user.is_active ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              {t("common.active")}
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" />
                              {t("common.inactive")}
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {getAccessSummary(user.customer_access)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.last_login_at ? (
                          <div className="text-xs text-muted-foreground">
                            {new Date(user.last_login_at).toLocaleDateString("it-IT", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("pages.store.portalUsers.never")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString("it-IT", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`${tenantPrefix}/b2b/store/portal-users/${user.portal_user_id}`}
                          className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition inline-flex"
                          title="View/Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t("common.showing")} {(pagination.page - 1) * pagination.limit + 1} {t("common.to")}{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} {t("common.of")}{" "}
                  {pagination.total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-medium text-foreground">
                    {t("common.page")} {pagination.page} {t("common.of")} {pagination.pages}
                  </div>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreatePortalUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchPortalUsers}
      />

    </div>
  );
}
