"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Key, RefreshCw } from "lucide-react";

interface Tenant {
  _id: string;
  tenant_id: string;
  name: string;
  status: "active" | "suspended" | "pending";
  admin_email: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AdminToken {
  token: string;
  created_at: string;
  description?: string;
  expires_at?: string | null;
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adminToken, setAdminToken] = useState<AdminToken | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    checkAuth();
    loadTenants();
    loadAdminToken();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/auth/me");
      if (!res.ok) {
        router.push("/super-admin/login");
        return;
      }
      const data = await res.json();
      setAdmin(data.admin);
    } catch {
      router.push("/super-admin/login");
    }
  };

  const loadTenants = async () => {
    try {
      const res = await fetch("/api/admin/tenants");
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error("Failed to load tenants:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminToken = async () => {
    try {
      const res = await fetch("/api/admin/token");
      if (res.ok) {
        const data = await res.json();
        setAdminToken(data);
      }
    } catch (err) {
      console.error("Failed to load admin token:", err);
    }
  };

  const refreshAdminToken = async () => {
    setTokenLoading(true);
    try {
      const res = await fetch("/api/admin/token");
      if (res.ok) {
        const data = await res.json();
        setAdminToken(data);
      }
    } catch (err) {
      console.error("Failed to refresh admin token:", err);
    } finally {
      setTokenLoading(false);
    }
  };

  const copyToken = async () => {
    if (!adminToken?.token) return;
    try {
      await navigator.clipboard.writeText(adminToken.token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy token:", err);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/super-admin/login");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-400";
      case "suspended":
        return "bg-red-500/20 text-red-400";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400";
      default:
        return "bg-slate-500/20 text-slate-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">VINC Admin</h1>
            <p className="text-sm text-slate-400">Tenant Management</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-300">{admin?.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Admin Token Section */}
        <div className="bg-slate-800 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-medium text-white">Cache Clear Token</h3>
                <p className="text-xs text-slate-400">Used by b2b instances to validate cache clear requests</p>
              </div>
            </div>
            <button
              onClick={refreshAdminToken}
              disabled={tokenLoading}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Refresh token"
            >
              <RefreshCw className={`h-4 w-4 ${tokenLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {adminToken ? (
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-sm font-mono text-slate-300 truncate">
                {adminToken.token}
              </code>
              <button
                onClick={copyToken}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors flex items-center gap-2"
              >
                {tokenCopied ? (
                  <>
                    <Check className="h-4 w-4 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-400">Loading token...</div>
          )}
          {adminToken?.created_at && (
            <p className="mt-2 text-xs text-slate-500">
              Created: {new Date(adminToken.created_at).toLocaleString()}
              {adminToken.description && ` - ${adminToken.description}`}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white">Tenants</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + Create Tenant
          </button>
        </div>

        {tenants.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center">
            <p className="text-slate-400">No tenants yet. Create your first tenant to get started.</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Tenant ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Admin Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {tenants.map((tenant) => (
                  <tr key={tenant._id} className="hover:bg-slate-700/50">
                    <td className="px-6 py-4 text-sm font-mono text-white">
                      {tenant.tenant_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {tenant.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {tenant.admin_email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(tenant.status)}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/super-admin/tenants/${tenant.tenant_id}`)}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadTenants();
          }}
        />
      )}
    </div>
  );
}

function CreateTenantModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState({
    tenant_id: "",
    name: "",
    admin_email: "",
    admin_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create tenant");
        return;
      }

      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Create New Tenant</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Tenant ID
            </label>
            <input
              type="text"
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              required
              pattern="[a-z][a-z0-9-]{2,49}"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="acme-corp"
            />
            <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, hyphens. 3-50 chars.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Acme Corporation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              value={formData.admin_email}
              onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@acme.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Admin Password
            </label>
            <input
              type="password"
              value={formData.admin_password}
              onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
              required
              minLength={8}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Min 8 characters"
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
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded transition-colors"
            >
              {loading ? "Creating..." : "Create Tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
