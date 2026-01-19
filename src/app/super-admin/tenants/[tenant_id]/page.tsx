"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface RateLimitSettings {
  enabled: boolean;
  requests_per_minute: number;
  requests_per_day: number;
  max_concurrent: number;
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
