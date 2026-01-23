"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface RateLimitSettings {
  enabled: boolean;
  requests_per_minute: number;
  requests_per_day: number;
  max_concurrent: number;
}

interface TenantDomain {
  hostname: string;
  is_primary?: boolean;
  is_active?: boolean;
}

interface TenantApiConfig {
  pim_api_url: string;
  b2b_api_url: string;
  api_key_id: string;
  api_secret: string;
}

interface TenantDbConfig {
  mongo_url: string;
  mongo_db: string;
}

interface Tenant {
  _id: string;
  tenant_id: string;
  name: string;
  status: "active" | "suspended" | "pending";
  admin_email: string;
  solr_core: string;
  mongo_db: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  settings?: {
    features?: string[];
    limits?: {
      max_products?: number;
      max_users?: number;
      max_orders?: number;
    };
    rate_limit?: RateLimitSettings;
  };
  // Multi-tenant support fields
  project_code?: string;
  domains?: TenantDomain[];
  api?: TenantApiConfig;
  database?: TenantDbConfig;
  require_login?: boolean;
  home_settings_customer_id?: string;
  builder_url?: string;
}

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenant_id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<{ today: number; this_month: number } | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitSettings>({
    enabled: false,
    requests_per_minute: 0,
    requests_per_day: 0,
    max_concurrent: 0,
  });
  const [rateLimitLoading, setRateLimitLoading] = useState(false);

  // Multi-tenant config state
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [apiConfig, setApiConfig] = useState<TenantApiConfig>({
    pim_api_url: "",
    b2b_api_url: "",
    api_key_id: "",
    api_secret: "",
  });
  const [dbConfig, setDbConfig] = useState<TenantDbConfig>({
    mongo_url: "",
    mongo_db: "",
  });
  const [projectCode, setProjectCode] = useState("");
  const [requireLogin, setRequireLogin] = useState(false);
  const [homeSettingsCustomerId, setHomeSettingsCustomerId] = useState("");
  const [builderUrl, setBuilderUrl] = useState("");
  const [multiTenantLoading, setMultiTenantLoading] = useState(false);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    loadTenant();
  }, [tenantId]);

  useEffect(() => {
    fetch(`/api/admin/tenants/${tenantId}/usage`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsage(data.usage);
        }
      })
      .catch(() => setUsage({ today: 0, this_month: 0 }));
  }, [tenantId]);

  useEffect(() => {
    fetch(`/api/admin/tenants/${tenantId}/rate-limit`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.rate_limit) {
          setRateLimit(data.rate_limit);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  // Domain management functions
  const addDomain = () => {
    setDomains([...domains, { hostname: "", is_primary: false, is_active: true }]);
  };

  const removeDomain = (index: number) => {
    setDomains(domains.filter((_, i) => i !== index));
  };

  const updateDomain = (index: number, field: keyof TenantDomain, value: string | boolean) => {
    const updated = [...domains];
    // Strip protocol from hostname (users often paste full URLs)
    let processedValue = value;
    if (field === "hostname" && typeof value === "string") {
      processedValue = value.replace(/^https?:\/\//, "").trim();
    }
    updated[index] = { ...updated[index], [field]: processedValue };
    // If setting as primary, unset others
    if (field === "is_primary" && value === true) {
      updated.forEach((d, i) => {
        if (i !== index) d.is_primary = false;
      });
    }
    setDomains(updated);
  };

  // Save multi-tenant configuration
  const handleMultiTenantSave = async () => {
    setMultiTenantLoading(true);
    setActionMessage("");
    try {
      const updates: Record<string, unknown> = {
        project_code: projectCode || `vinc-${tenantId}`,
        domains: domains.filter(d => d.hostname.trim() !== ""),
        require_login: requireLogin,
        home_settings_customer_id: homeSettingsCustomerId,
        builder_url: builderUrl,
      };

      // Only include api config if at least one field is filled
      if (apiConfig.pim_api_url || apiConfig.b2b_api_url || apiConfig.api_key_id) {
        updates.api = apiConfig;
      }

      // Only include database config if at least one field is filled
      if (dbConfig.mongo_url || dbConfig.mongo_db) {
        updates.database = dbConfig;
      }

      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || "Failed to update multi-tenant config");
        return;
      }
      setTenant(data.tenant);
      setActionMessage("Multi-tenant configuration saved successfully");
    } catch {
      setActionMessage("Network error");
    } finally {
      setMultiTenantLoading(false);
    }
  };

  const handleRateLimitSave = async () => {
    setRateLimitLoading(true);
    setActionMessage("");
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/rate-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rateLimit),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || "Failed to update rate limit");
        return;
      }
      setActionMessage("Rate limit settings saved successfully");
    } catch {
      setActionMessage("Network error");
    } finally {
      setRateLimitLoading(false);
    }
  };

  const loadTenant = async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/super-admin/login");
          return;
        }
        const data = await res.json();
        setError(data.error || "Failed to load tenant");
        return;
      }
      const data = await res.json();
      setTenant(data.tenant);

      // Load multi-tenant config
      if (data.tenant.domains) setDomains(data.tenant.domains);
      if (data.tenant.api) setApiConfig(data.tenant.api);
      if (data.tenant.database) setDbConfig(data.tenant.database);
      if (data.tenant.project_code) setProjectCode(data.tenant.project_code);
      if (data.tenant.require_login) setRequireLogin(data.tenant.require_login);
      if (data.tenant.home_settings_customer_id) setHomeSettingsCustomerId(data.tenant.home_settings_customer_id);
      if (data.tenant.builder_url) setBuilderUrl(data.tenant.builder_url);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: "active" | "suspended") => {
    setActionLoading(true);
    setActionMessage("");
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || "Failed to update status");
        return;
      }
      setTenant(data.tenant);
      setActionMessage(`Tenant ${newStatus === "active" ? "activated" : "suspended"} successfully`);
    } catch {
      setActionMessage("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "suspended":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Tenant not found"}</p>
          <button
            onClick={() => router.push("/super-admin/dashboard")}
            className="text-blue-400 hover:text-blue-300"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <button
            onClick={() => router.push("/super-admin/dashboard")}
            className="text-slate-400 hover:text-white text-sm mb-2 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
              <span className={`px-3 py-1 text-sm rounded-full border ${getStatusColor(tenant.status)}`}>
                {tenant.status}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Action Message */}
        {actionMessage && (
          <div className={`p-4 rounded-lg ${actionMessage.includes("error") || actionMessage.includes("Failed") ? "bg-red-500/10 border border-red-500 text-red-400" : "bg-green-500/10 border border-green-500 text-green-400"}`}>
            {actionMessage}
          </div>
        )}

        {/* Overview Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Overview</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">Tenant ID</label>
                <p className="text-white font-mono">{tenant.tenant_id}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Company Name</label>
                <p className="text-white">{tenant.name}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Admin Email</label>
                <p className="text-white">{tenant.admin_email}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Status</label>
                <p className="text-white capitalize">{tenant.status}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Created</label>
                <p className="text-white">{new Date(tenant.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Created By</label>
                <p className="text-white">{tenant.created_by || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Infrastructure Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Infrastructure</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">MongoDB Database</label>
                <p className="text-white font-mono">{tenant.mongo_db || `vinc-${tenant.tenant_id}`}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Solr Collection</label>
                <p className="text-white font-mono">{tenant.solr_core || `vinc-${tenant.tenant_id}`}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Tenant Configuration Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Multi-Tenant Configuration</h2>
            <p className="text-sm text-slate-400 mt-1">Configure domains and API access for this tenant</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Project Code */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Project Code</label>
              <input
                type="text"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder={`vinc-${tenant.tenant_id}`}
                className="w-full max-w-md px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">Used for identification across systems</p>
            </div>

            {/* Domains Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">Domains</label>
                <button
                  onClick={addDomain}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  + Add Domain
                </button>
              </div>
              {domains.length === 0 ? (
                <>
                  <p className="text-sm text-slate-500">No domains configured. Add a domain to enable multi-tenant access.</p>
                  <p className="text-xs text-slate-500 mt-1">Enter hostname only (e.g., shop.example.com), protocol will be stripped automatically</p>
                </>
              ) : (
                <div className="space-y-2">
                  {domains.map((domain, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
                      <input
                        type="text"
                        value={domain.hostname}
                        onChange={(e) => updateDomain(index, "hostname", e.target.value)}
                        placeholder="shop.example.com"
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-300 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={domain.is_primary || false}
                          onChange={(e) => updateDomain(index, "is_primary", e.target.checked)}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        Primary
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={domain.is_active !== false}
                          onChange={(e) => updateDomain(index, "is_active", e.target.checked)}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        Active
                      </label>
                      <button
                        onClick={() => removeDomain(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove domain"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* API Configuration */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">API Configuration</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">PIM API URL</label>
                  <input
                    type="text"
                    value={apiConfig.pim_api_url}
                    onChange={(e) => setApiConfig({ ...apiConfig, pim_api_url: e.target.value })}
                    placeholder="https://api.example.com"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">B2B API URL</label>
                  <input
                    type="text"
                    value={apiConfig.b2b_api_url}
                    onChange={(e) => setApiConfig({ ...apiConfig, b2b_api_url: e.target.value })}
                    placeholder="https://api.example.com"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">API Key ID</label>
                  <input
                    type="text"
                    value={apiConfig.api_key_id}
                    onChange={(e) => setApiConfig({ ...apiConfig, api_key_id: e.target.value })}
                    placeholder={`ak_${tenant.tenant_id}_xxxx`}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">API Secret</label>
                  <input
                    type="password"
                    value={apiConfig.api_secret}
                    onChange={(e) => setApiConfig({ ...apiConfig, api_secret: e.target.value })}
                    placeholder="sk_xxxx"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">API keys can be created in the tenant's apikeys collection</p>
            </div>

            {/* Database Configuration */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Database Override</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">MongoDB URL</label>
                  <input
                    type="text"
                    value={dbConfig.mongo_url}
                    onChange={(e) => setDbConfig({ ...dbConfig, mongo_url: e.target.value })}
                    placeholder="mongodb://..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">MongoDB Database</label>
                  <input
                    type="text"
                    value={dbConfig.mongo_db}
                    onChange={(e) => setDbConfig({ ...dbConfig, mongo_db: e.target.value })}
                    placeholder={`vinc-${tenant.tenant_id}`}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Only set if using a different database connection</p>
            </div>

            {/* Additional Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Home Settings Customer ID</label>
                <input
                  type="text"
                  value={homeSettingsCustomerId}
                  onChange={(e) => setHomeSettingsCustomerId(e.target.value)}
                  placeholder="default"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Builder URL</label>
                <input
                  type="text"
                  value={builderUrl}
                  onChange={(e) => setBuilderUrl(e.target.value)}
                  placeholder="https://builder.example.com"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Require Login Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-white">Require Login</label>
                <p className="text-xs text-slate-400">Users must log in to view any page</p>
              </div>
              <button
                onClick={() => setRequireLogin(!requireLogin)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  requireLogin ? "bg-blue-600" : "bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    requireLogin ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                onClick={handleMultiTenantSave}
                disabled={multiTenantLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {multiTenantLoading ? "Saving..." : "Save Multi-Tenant Configuration"}
              </button>
            </div>
          </div>
        </div>

        {/* API Usage Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">API Usage</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400">Today</label>
                <p className="text-2xl font-bold text-white">
                  {usage?.today.toLocaleString() ?? "—"}
                </p>
                <p className="text-xs text-slate-500">requests</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">This Month</label>
                <p className="text-2xl font-bold text-white">
                  {usage?.this_month.toLocaleString() ?? "—"}
                </p>
                <p className="text-xs text-slate-500">requests</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limit Configuration Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Rate Limiting</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-white">Enable Rate Limiting</label>
                <p className="text-xs text-slate-400">Limit API requests for this tenant</p>
              </div>
              <button
                onClick={() => setRateLimit({ ...rateLimit, enabled: !rateLimit.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  rateLimit.enabled ? "bg-blue-600" : "bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rateLimit.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {rateLimit.enabled && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Requests per minute */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Per Minute
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={rateLimit.requests_per_minute || ""}
                      onChange={(e) =>
                        setRateLimit({
                          ...rateLimit,
                          requests_per_minute: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0 = unlimited"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Burst protection</p>
                  </div>

                  {/* Requests per day */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Per Day
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={rateLimit.requests_per_day || ""}
                      onChange={(e) =>
                        setRateLimit({
                          ...rateLimit,
                          requests_per_day: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0 = unlimited"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Daily quota</p>
                  </div>

                  {/* Max concurrent */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Concurrent
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={rateLimit.max_concurrent || ""}
                      onChange={(e) =>
                        setRateLimit({
                          ...rateLimit,
                          max_concurrent: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0 = unlimited"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Max simultaneous</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Set any value to 0 for unlimited. Daily quota resets at midnight UTC.
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleRateLimitSave}
                disabled={rateLimitLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {rateLimitLoading ? "Saving..." : "Save Rate Limit Settings"}
              </button>
            </div>

            {!rateLimit.enabled && (
              <p className="text-sm text-slate-400">
                Rate limiting is disabled. API requests are not limited for this tenant.
              </p>
            )}
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Actions</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Edit Name
              </button>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Reset Admin Password
              </button>
              {tenant.status === "active" ? (
                <button
                  onClick={() => handleStatusChange("suspended")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {actionLoading ? "Processing..." : "Suspend Tenant"}
                </button>
              ) : (
                <button
                  onClick={() => handleStatusChange("active")}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {actionLoading ? "Processing..." : "Activate Tenant"}
                </button>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete Tenant
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Name Modal */}
      {showEditModal && (
        <EditNameModal
          currentName={tenant.name}
          tenantId={tenantId}
          onClose={() => setShowEditModal(false)}
          onSaved={(newName) => {
            setTenant({ ...tenant, name: newName });
            setShowEditModal(false);
            setActionMessage("Name updated successfully");
          }}
        />
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && (
        <ResetPasswordModal
          tenantId={tenantId}
          adminEmail={tenant.admin_email}
          onClose={() => setShowPasswordModal(false)}
          onReset={() => {
            setShowPasswordModal(false);
            setActionMessage("Password reset successfully");
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          tenantId={tenantId}
          tenantName={tenant.name}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            router.push("/super-admin/dashboard");
          }}
        />
      )}
    </div>
  );
}

// Edit Name Modal Component
function EditNameModal({
  currentName,
  tenantId,
  onClose,
  onSaved,
}: {
  currentName: string;
  tenantId: string;
  onClose: () => void;
  onSaved: (newName: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update name");
        return;
      }

      onSaved(name);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Edit Company Name</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reset Password Modal Component
function ResetPasswordModal({
  tenantId,
  adminEmail,
  onClose,
  onReset,
}: {
  tenantId: string;
  adminEmail: string;
  onClose: () => void;
  onReset: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      onReset();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Reset Admin Password</h3>
          <p className="text-sm text-slate-400 mt-1">For: {adminEmail}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                placeholder="Min 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm password"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded transition-colors"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal Component
function DeleteConfirmModal({
  tenantId,
  tenantName,
  onClose,
  onDeleted,
}: {
  tenantId: string;
  tenantName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (confirmText !== tenantId) {
      setError(`Please type "${tenantId}" to confirm`);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}?confirm=yes`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to delete tenant");
        return;
      }

      onDeleted();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-red-400">Delete Tenant</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded text-sm">
            <strong>Warning:</strong> This action is irreversible! This will permanently delete:
            <ul className="list-disc list-inside mt-2">
              <li>MongoDB database (vinc-{tenantId})</li>
              <li>Solr collection (vinc-{tenantId})</li>
              <li>All tenant data and users</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Type <span className="font-mono text-red-400">{tenantId}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={tenantId}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || confirmText !== tenantId}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              {loading ? "Deleting..." : "Delete Permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
