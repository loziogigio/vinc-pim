"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit2,
  Trash2,
  Shield,
  Globe,
  X,
  Layers,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface PlatformApp {
  _id: string;
  app_id: string;
  name: string;
  description?: string;
  url: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export default function PlatformAppsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [apps, setApps] = useState<PlatformApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingApp, setEditingApp] = useState<PlatformApp | null>(null);

  useEffect(() => {
    checkAuth();
    loadApps();
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

  const loadApps = async () => {
    try {
      const res = await fetch("/api/admin/platform-apps");
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
      }
    } catch (err) {
      console.error("Failed to load platform apps:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/super-admin/login");
  };

  const handleDelete = async (appId: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${appId}"?\n\nThis will remove the app from all tenants.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/platform-apps/${appId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        loadApps();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete app");
      }
    } catch (err) {
      console.error("Failed to delete app:", err);
      alert("Failed to delete app");
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
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-xl font-bold text-white">VINC Admin</h1>
              <p className="text-sm text-slate-400">Super Admin Dashboard</p>
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
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
              >
                <Globe className="h-4 w-4" />
                Domains
              </Link>
              <Link
                href="/super-admin/platform-apps"
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-slate-700 rounded transition-colors"
              >
                <Layers className="h-4 w-4" />
                Platform Apps
              </Link>
            </nav>
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Layers className="h-6 w-6 text-blue-400" />
            <h2 className="text-2xl font-semibold text-white">
              Platform Apps
            </h2>
            <span className="text-sm text-slate-400">({apps.length})</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            New App
          </button>
        </div>

        {apps.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center">
            <Layers className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No platform apps yet.</p>
            <p className="text-slate-500 text-sm mt-2">
              Create your first app to make it available to tenants.
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    App ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {apps.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {app.color && (
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: app.color }}
                          />
                        )}
                        <code className="text-sm font-mono text-white">
                          {app.app_id}
                        </code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white">{app.name}</span>
                      {app.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                          {app.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 max-w-[250px]">
                        <span
                          className="text-xs text-slate-400 font-mono truncate"
                          title={app.url}
                        >
                          {app.url}
                        </span>
                        {app.url && (
                          <a
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-blue-400 flex-shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-400">
                        {app.sort_order}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {app.is_active ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingApp(app)}
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                          title="Edit app"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(app.app_id)}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete app"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <AppFormModal
          usedAppIds={apps.map((a) => a.app_id)}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            loadApps();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingApp && (
        <AppFormModal
          app={editingApp}
          usedAppIds={apps.map((a) => a.app_id)}
          onClose={() => setEditingApp(null)}
          onSaved={() => {
            setEditingApp(null);
            loadApps();
          }}
        />
      )}
    </div>
  );
}

interface OAuthClient {
  client_id: string;
  name: string;
  redirect_uris: string[];
  logo_url?: string;
  is_active: boolean;
}

function AppFormModal({
  app,
  usedAppIds,
  onClose,
  onSaved,
}: {
  app?: PlatformApp;
  usedAppIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!app;
  const [formData, setFormData] = useState({
    app_id: app?.app_id || "",
    name: app?.name || "",
    description: app?.description || "",
    url: app?.url || "",
    icon: app?.icon || "",
    color: app?.color || "",
    is_active: app?.is_active ?? true,
    sort_order: app?.sort_order ?? 0,
  });
  const [oauthClients, setOauthClients] = useState<OAuthClient[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch OAuth clients for the App ID dropdown
  useEffect(() => {
    fetch("/api/admin/oauth-clients")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.clients) {
          setOauthClients(data.clients.filter((c: OAuthClient) => c.is_active));
        }
      })
      .catch(() => {});
  }, []);

  const handleClientSelect = (clientId: string) => {
    const client = oauthClients.find((c) => c.client_id === clientId);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        app_id: client.client_id,
        name: prev.name || client.name,
        url: prev.url || (client.redirect_uris?.[0] || "").replace(/\/api\/auth\/callback$/, ""),
        icon: prev.icon || client.logo_url || "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, app_id: clientId }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEditing
        ? `/api/admin/platform-apps/${app.app_id}`
        : "/api/admin/platform-apps";

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sort_order: Number(formData.sort_order) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save app");
        return;
      }

      onSaved();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? "Edit App" : "Create Platform App"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              App ID (OAuth Client) *
            </label>
            <select
              value={formData.app_id}
              onChange={(e) => handleClientSelect(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an OAuth client...</option>
              {oauthClients
                .filter((c) => !usedAppIds.includes(c.client_id) || c.client_id === app?.app_id)
                .map((client) => (
                  <option key={client.client_id} value={client.client_id}>
                    {client.name} ({client.client_id})
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Select from registered OAuth clients
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Application"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Redirect URL *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://app.example.com"
            />
            <p className="text-xs text-slate-500 mt-1">
              Where users are redirected when they click this app
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Short description of this app"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Icon (optional)
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="icon-name or URL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Color (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#3b82f6"
                />
                {formData.color && (
                  <span
                    className="w-10 h-10 rounded border border-slate-600"
                    style={{ backgroundColor: formData.color }}
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={formData.sort_order}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sort_order: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="w-4 h-4 bg-slate-700 border-slate-600 rounded"
            />
            <label htmlFor="is_active" className="text-sm text-slate-300">
              App is active
            </label>
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
              {loading
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create App"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
