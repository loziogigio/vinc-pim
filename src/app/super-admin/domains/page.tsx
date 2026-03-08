"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  RefreshCw,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Shield,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface DomainEntry {
  hostname: string;
  type: "b2b" | "b2c";
  tenant_id: string;
  tenant_name: string;
  project_code: string;
  tenant_status: string;
  is_primary: boolean;
  is_active: boolean;
  in_traefik: boolean;
  storefront_name?: string;
  storefront_slug?: string;
  storefront_status?: string;
}

interface LastSync {
  b2b?: string;
  b2c?: string;
}

type TypeFilter = "all" | "b2b" | "b2c";
type StatusFilter = "all" | "routed" | "not-routed";
const PAGE_SIZES = [10, 25, 50, 100] as const;

export default function DomainsPage() {
  const router = useRouter();
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [lastSync, setLastSync] = useState<LastSync>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [collapsedTenants, setCollapsedTenants] = useState<Set<string>>(new Set());
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    checkAuth();
    loadDomains();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/auth/me");
      if (!res.ok) router.push("/super-admin/login");
    } catch {
      router.push("/super-admin/login");
    }
  };

  const loadDomains = async () => {
    try {
      const res = await fetch("/api/admin/traefik/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
        setLastSync(data.last_sync || {});
      }
    } catch (err) {
      console.error("Failed to load domains:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/admin/traefik/regenerate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage({
          text: `Synced: ${data.b2b?.domains_count || 0} B2B + ${data.b2c?.domains_count || 0} B2C domains`,
          type: "success",
        });
        await loadDomains();
      } else {
        setSyncMessage({ text: data.error || "Sync failed", type: "error" });
      }
    } catch {
      setSyncMessage({ text: "Network error during sync", type: "error" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Unique tenant list for filter dropdown
  const tenantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of domains) {
      if (!seen.has(d.tenant_id)) seen.set(d.tenant_id, d.tenant_name);
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [domains]);

  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (statusFilter === "routed" && !d.in_traefik) return false;
      if (statusFilter === "not-routed" && d.in_traefik) return false;
      if (tenantFilter !== "all" && d.tenant_id !== tenantFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.hostname.includes(q) ||
          d.tenant_id.includes(q) ||
          d.tenant_name.toLowerCase().includes(q) ||
          d.project_code.toLowerCase().includes(q) ||
          (d.storefront_name || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [domains, typeFilter, statusFilter, tenantFilter, search]);

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter, tenantFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDomains.length / pageSize));
  const paginatedDomains = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDomains.slice(start, start + pageSize);
  }, [filteredDomains, page, pageSize]);

  // Group by tenant (paginated slice)
  const groupedByTenant = useMemo(() => {
    const map = new Map<string, { tenant_id: string; tenant_name: string; project_code: string; tenant_status: string; domains: DomainEntry[] }>();
    for (const d of paginatedDomains) {
      if (!map.has(d.tenant_id)) {
        map.set(d.tenant_id, {
          tenant_id: d.tenant_id,
          tenant_name: d.tenant_name,
          project_code: d.project_code,
          tenant_status: d.tenant_status,
          domains: [],
        });
      }
      map.get(d.tenant_id)!.domains.push(d);
    }
    return Array.from(map.values()).sort((a, b) => a.tenant_id.localeCompare(b.tenant_id));
  }, [paginatedDomains]);

  const toggleTenant = (tenantId: string) => {
    setCollapsedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  };

  const toggleSelectDomain = (hostname: string) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(hostname)) next.delete(hostname);
      else next.add(hostname);
      return next;
    });
  };

  const selectAll = () => {
    const pageHostnames = paginatedDomains.map((d) => d.hostname);
    const allSelected = pageHostnames.every((h) => selectedDomains.has(h));
    if (allSelected) {
      setSelectedDomains((prev) => {
        const next = new Set(prev);
        pageHostnames.forEach((h) => next.delete(h));
        return next;
      });
    } else {
      setSelectedDomains((prev) => new Set([...prev, ...pageHostnames]));
    }
  };

  const stats = useMemo(() => ({
    total: domains.length,
    b2b: domains.filter((d) => d.type === "b2b").length,
    b2c: domains.filter((d) => d.type === "b2c").length,
    routed: domains.filter((d) => d.in_traefik).length,
    notRouted: domains.filter((d) => !d.in_traefik).length,
  }), [domains]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/20 text-green-400";
      case "suspended": return "bg-red-500/20 text-red-400";
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "inactive": return "bg-slate-500/20 text-slate-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading domains...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-xl font-bold text-white">VINC Admin</h1>
              <p className="text-sm text-slate-400">Domain Management</p>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/super-admin/dashboard"
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                Tenants
              </Link>
              <Link
                href="/super-admin/oauth-clients"
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                <Shield className="h-4 w-4" />
                OAuth Clients
              </Link>
              <Link
                href="/super-admin/domains"
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-slate-700 rounded transition-colors"
              >
                <Globe className="h-4 w-4" />
                Domains
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-400">Total Domains</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-blue-400">{stats.b2b}</p>
            <p className="text-xs text-slate-400">B2B Domains</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-purple-400">{stats.b2c}</p>
            <p className="text-xs text-slate-400">B2C Domains</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-green-400">{stats.routed}</p>
            <p className="text-xs text-slate-400">In Traefik</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-2xl font-bold text-amber-400">{stats.notRouted}</p>
            <p className="text-xs text-slate-400">Not Routed</p>
          </div>
        </div>

        {/* Last Sync Info + Resync */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-slate-400">B2B last sync: </span>
              <span className="text-slate-200">
                {lastSync.b2b ? new Date(lastSync.b2b).toLocaleString() : "Never"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">B2C last sync: </span>
              <span className="text-slate-200">
                {lastSync.b2c ? new Date(lastSync.b2c).toLocaleString() : "Never"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {syncMessage && (
              <span className={`text-sm ${syncMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                {syncMessage.text}
              </span>
            )}
            <button
              onClick={handleResync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-600/50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Resync All"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domains, tenants, project codes..."
              className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="b2b">B2B Only</option>
              <option value="b2c">B2C Only</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="routed">Routed in Traefik</option>
              <option value="not-routed">Not Routed</option>
            </select>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tenants</option>
              {tenantOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
              ))}
            </select>
          </div>
          <button
            onClick={selectAll}
            className="px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            {paginatedDomains.length > 0 && paginatedDomains.every((d) => selectedDomains.has(d.hostname))
              ? "Deselect Page"
              : "Select Page"}
          </button>
        </div>

        {/* Pagination Info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-400">
            Showing {filteredDomains.length === 0 ? 0 : (page - 1) * pageSize + 1}
            {" - "}{Math.min(page * pageSize, filteredDomains.length)} of {filteredDomains.length} domains
            {selectedDomains.size > 0 && (
              <span className="ml-2 text-blue-400">({selectedDomains.size} selected)</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Domain List Grouped by Tenant */}
        {groupedByTenant.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center">
            <p className="text-slate-400">No domains found matching your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedByTenant.map((group) => {
              const isCollapsed = collapsedTenants.has(group.tenant_id);
              const routedCount = group.domains.filter((d) => d.in_traefik).length;

              return (
                <div key={group.tenant_id} className="bg-slate-800 rounded-lg overflow-hidden">
                  {/* Tenant Header */}
                  <button
                    onClick={() => toggleTenant(group.tenant_id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{group.tenant_name}</span>
                          <span className={`px-2 py-0.5 text-[10px] rounded-full ${getStatusColor(group.tenant_status)}`}>
                            {group.tenant_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400 font-mono">{group.tenant_id}</span>
                          {group.project_code && (
                            <span className="text-xs text-slate-500">
                              project: <span className="text-slate-400">{group.project_code}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{group.domains.length} domain{group.domains.length !== 1 ? "s" : ""}</span>
                      <span className="text-green-400">{routedCount} routed</span>
                      <Link
                        href={`/super-admin/tenants/${group.tenant_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Manage
                      </Link>
                    </div>
                  </button>

                  {/* Domain Rows */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-700">
                      <table className="w-full">
                        <thead className="bg-slate-700/30">
                          <tr>
                            <th className="w-8 px-4 py-2"></th>
                            <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-400 uppercase">Domain</th>
                            <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-400 uppercase">Type</th>
                            <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-400 uppercase">Details</th>
                            <th className="px-4 py-2 text-left text-[10px] font-medium text-slate-400 uppercase">Traefik</th>
                            <th className="px-4 py-2 text-right text-[10px] font-medium text-slate-400 uppercase">Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {group.domains.map((d, idx) => (
                            <tr
                              key={`${d.hostname}-${idx}`}
                              className={`hover:bg-slate-700/30 ${selectedDomains.has(d.hostname) ? "bg-blue-900/20" : ""}`}
                            >
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedDomains.has(d.hostname)}
                                  onChange={() => toggleSelectDomain(d.hostname)}
                                  className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <span className="text-sm font-mono text-white">{d.hostname}</span>
                                {d.is_primary && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                    primary
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  d.type === "b2b"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "bg-purple-500/20 text-purple-400"
                                }`}>
                                  {d.type.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-400">
                                {d.type === "b2c" && d.storefront_name && (
                                  <span>
                                    {d.storefront_name}
                                    {d.storefront_status && (
                                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${getStatusColor(d.storefront_status)}`}>
                                        {d.storefront_status}
                                      </span>
                                    )}
                                  </span>
                                )}
                                {d.type === "b2b" && (
                                  <span>{d.is_active ? "Active" : "Inactive"}</span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                {d.in_traefik ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-slate-500" />
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <a
                                  href={`https://${d.hostname}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-2 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === "ellipsis" ? (
                  <span key={`e-${i}`} className="px-1 text-slate-500">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      page === item
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-700"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="p-2 text-slate-400 hover:text-white disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
