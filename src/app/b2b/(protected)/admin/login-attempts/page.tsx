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

const FAILURE_REASON_LABELS: Record<string, string> = {
  invalid_credentials: "Credenziali non valide",
  user_not_found: "Utente non trovato",
  user_blocked: "Utente bloccato",
  tenant_blocked: "Tenant bloccato",
  ip_blocked: "IP bloccato",
  rate_limited: "Troppi tentativi",
  mfa_failed: "MFA fallito",
  expired_password: "Password scaduta",
  account_locked: "Account bloccato",
};

export default function LoginAttemptsPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Login Attempts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cronologia tentativi di accesso (ultimi 30 giorni)
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca per email o IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "" | "success" | "failed");
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="">Tutti</option>
            <option value="success">Riusciti</option>
            <option value="failed">Falliti</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Nessun tentativo di login trovato</p>
        </div>
      ) : (
        <>
          {/* Attempts Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Data/Ora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      IP / Posizione
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Dispositivo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Client
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {attempts.map((a) => (
                    <tr key={a._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {formatDate(a.timestamp)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">
                          {a.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.success ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Riuscito
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 rounded-full">
                              <XCircle className="w-3 h-3" />
                              Fallito
                            </span>
                            {a.failure_reason && (
                              <p className="text-xs text-slate-500 mt-1">
                                {FAILURE_REASON_LABELS[a.failure_reason] ||
                                  a.failure_reason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm text-slate-900 font-mono">
                              {a.ip_address}
                            </p>
                            {(a.city || a.country) && (
                              <p className="text-xs text-slate-500">
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
                            <p className="text-sm text-slate-900">
                              {a.browser || "Unknown"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {a.os || "Unknown OS"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
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
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Mostrando {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                di {pagination.total}
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
                  Pagina {pagination.page} di {pagination.totalPages}
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
