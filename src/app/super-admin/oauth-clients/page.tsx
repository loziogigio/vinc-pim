"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  Key,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Shield,
  AlertTriangle,
  X,
  Info,
} from "lucide-react";
import Link from "next/link";

interface OAuthClient {
  _id: string;
  client_id: string;
  name: string;
  type: "web" | "mobile" | "api";
  redirect_uris?: string[];
  description: string;
  is_first_party: boolean;
  is_active: boolean;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export default function OAuthClientsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClient, setEditingClient] = useState<OAuthClient | null>(null);
  const [regeneratingClient, setRegeneratingClient] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<{ clientId: string; secret: string } | null>(null);

  useEffect(() => {
    checkAuth();
    loadClients();
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

  const loadClients = async () => {
    try {
      const res = await fetch("/api/admin/oauth-clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error("Failed to load OAuth clients:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/super-admin/login");
  };

  const handleRegenerateSecret = async (clientId: string) => {
    if (!confirm(`Are you sure you want to regenerate the secret for "${clientId}"?\n\nThe old secret will be immediately invalidated.`)) {
      return;
    }

    setRegeneratingClient(clientId);
    try {
      const res = await fetch(`/api/admin/oauth-clients/${clientId}/regenerate-secret`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.client_secret) {
        setNewSecret({ clientId, secret: data.client_secret });
      } else {
        alert(data.error || "Failed to regenerate secret");
      }
    } catch (err) {
      console.error("Failed to regenerate secret:", err);
      alert("Failed to regenerate secret");
    } finally {
      setRegeneratingClient(null);
    }
  };

  const handleDeactivate = async (clientId: string) => {
    if (!confirm(`Are you sure you want to deactivate "${clientId}"?\n\nThis client will no longer be able to authenticate.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/oauth-clients/${clientId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        loadClients();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to deactivate client");
      }
    } catch (err) {
      console.error("Failed to deactivate client:", err);
      alert("Failed to deactivate client");
    }
  };

  const handleReactivate = async (clientId: string) => {
    try {
      const res = await fetch(`/api/admin/oauth-clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });

      if (res.ok) {
        loadClients();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to reactivate client");
      }
    } catch (err) {
      console.error("Failed to reactivate client:", err);
      alert("Failed to reactivate client");
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "web":
        return "bg-blue-500/20 text-blue-400";
      case "mobile":
        return "bg-purple-500/20 text-purple-400";
      case "api":
        return "bg-amber-500/20 text-amber-400";
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
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-slate-700 rounded transition-colors"
              >
                <Shield className="h-4 w-4" />
                OAuth Clients
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
        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium">Redirect URI Validation</p>
            <p className="text-blue-300/80 mt-1">
              For <strong>web clients</strong>, redirect URIs are validated against tenant-configured domains (no setup needed here).
              Only <strong>mobile clients</strong> need explicit redirect URIs for deep links.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-amber-400" />
            <h2 className="text-2xl font-semibold text-white">OAuth Clients</h2>
            <span className="text-sm text-slate-400">({clients.length})</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Client
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center">
            <Key className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No OAuth clients yet.</p>
            <p className="text-slate-500 text-sm mt-2">
              Create your first client to enable SSO authentication.
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Client ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Deep Links
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
                {clients.map((client) => (
                  <tr key={client._id} className="hover:bg-slate-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-white">
                          {client.client_id}
                        </code>
                        {client.is_first_party && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded">
                            1st party
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {client.name}
                      {client.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                          {client.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getTypeColor(client.type)}`}
                      >
                        {client.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {client.type === "mobile" && client.redirect_uris?.length ? (
                        <div className="space-y-1 max-w-[250px]">
                          {client.redirect_uris.slice(0, 2).map((uri, i) => (
                            <div
                              key={i}
                              className="text-xs text-slate-400 font-mono truncate"
                              title={uri}
                            >
                              {uri}
                            </div>
                          ))}
                          {client.redirect_uris.length > 2 && (
                            <div className="text-xs text-slate-500">
                              +{client.redirect_uris.length - 2} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {client.type === "web" ? "Uses tenant domains" : "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {client.is_active ? (
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
                          onClick={() => setEditingClient(client)}
                          className="p-2 text-slate-400 hover:text-white transition-colors"
                          title="Edit client"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRegenerateSecret(client.client_id)}
                          disabled={regeneratingClient === client.client_id}
                          className="p-2 text-slate-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                          title="Regenerate secret"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              regeneratingClient === client.client_id ? "animate-spin" : ""
                            }`}
                          />
                        </button>
                        {client.is_active ? (
                          <button
                            onClick={() => handleDeactivate(client.client_id)}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                            title="Deactivate client"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(client.client_id)}
                            className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
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
        <CreateClientModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(secret) => {
            setShowCreateModal(false);
            if (secret) {
              setNewSecret(secret);
            }
            loadClients();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={() => {
            setEditingClient(null);
            loadClients();
          }}
        />
      )}

      {/* New Secret Modal */}
      {newSecret && (
        <SecretDisplayModal
          clientId={newSecret.clientId}
          secret={newSecret.secret}
          onClose={() => setNewSecret(null)}
        />
      )}
    </div>
  );
}

function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (secret?: { clientId: string; secret: string }) => void;
}) {
  const [formData, setFormData] = useState({
    client_id: "",
    name: "",
    type: "web" as "web" | "mobile" | "api",
    redirect_uris: "",
    description: "",
    is_first_party: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMobile = formData.type === "mobile";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const redirectUris = isMobile
      ? formData.redirect_uris
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    if (isMobile && redirectUris.length === 0) {
      setError("Mobile apps require at least one deep link URI");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/oauth-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: formData.client_id,
          name: formData.name,
          type: formData.type,
          redirect_uris: redirectUris,
          description: formData.description,
          is_first_party: formData.is_first_party,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create client");
        return;
      }

      onCreated({ clientId: data.client.client_id, secret: data.client_secret });
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
          <h3 className="text-lg font-semibold text-white">Create OAuth Client</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
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
              Client ID *
            </label>
            <input
              type="text"
              value={formData.client_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  client_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                })
              }
              required
              pattern="[a-z0-9-]+"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="my-app"
            />
            <p className="text-xs text-slate-500 mt-1">
              Lowercase letters, numbers, and dashes only
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Application"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Client Type
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as "web" | "mobile" | "api" })
              }
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="web">Web Application</option>
              <option value="mobile">Mobile App</option>
              <option value="api">API / Service</option>
            </select>
            {!isMobile && (
              <p className="text-xs text-slate-500 mt-1">
                Web apps use tenant-configured domains for redirect validation
              </p>
            )}
          </div>

          {isMobile && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Deep Link URIs * (one per line)
              </label>
              <textarea
                value={formData.redirect_uris}
                onChange={(e) => setFormData({ ...formData, redirect_uris: e.target.value })}
                required={isMobile}
                rows={3}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="myapp://auth/callback&#10;com.mycompany.myapp://auth/callback"
              />
              <p className="text-xs text-slate-500 mt-1">
                Custom URL schemes for mobile app callbacks
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Short description of this client"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_first_party"
              checked={formData.is_first_party}
              onChange={(e) => setFormData({ ...formData, is_first_party: e.target.checked })}
              className="w-4 h-4 bg-slate-700 border-slate-600 rounded"
            />
            <label htmlFor="is_first_party" className="text-sm text-slate-300">
              First-party application (skip consent screen)
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
              {loading ? "Creating..." : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: OAuthClient;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    name: client.name,
    redirect_uris: (client.redirect_uris || []).join("\n"),
    description: client.description,
    is_active: client.is_active,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMobile = client.type === "mobile";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const redirectUris = isMobile
      ? formData.redirect_uris
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean)
      : undefined;

    if (isMobile && (!redirectUris || redirectUris.length === 0)) {
      setError("Mobile apps require at least one deep link URI");
      setLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
      };

      if (isMobile) {
        body.redirect_uris = redirectUris;
      }

      const res = await fetch(`/api/admin/oauth-clients/${client.client_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update client");
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
          <div>
            <h3 className="text-lg font-semibold text-white">Edit OAuth Client</h3>
            <p className="text-sm text-slate-400 font-mono">{client.client_id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
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
              Display Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isMobile && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Deep Link URIs (one per line)
              </label>
              <textarea
                value={formData.redirect_uris}
                onChange={(e) => setFormData({ ...formData, redirect_uris: e.target.value })}
                required
                rows={3}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Custom URL schemes for mobile app callbacks
              </p>
            </div>
          )}

          {!isMobile && (
            <div className="bg-slate-700/50 rounded-lg p-3">
              <p className="text-xs text-slate-400">
                <strong>Note:</strong> Web applications use tenant-configured domains for redirect URI validation.
                Configure domains in the tenant settings.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 bg-slate-700 border-slate-600 rounded"
            />
            <label htmlFor="is_active" className="text-sm text-slate-300">
              Client is active
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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SecretDisplayModal({
  clientId,
  secret,
  onClose,
}: {
  clientId: string;
  secret: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Client Secret Generated</h3>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Save this secret now!</p>
              <p className="text-amber-300/80 mt-1">
                This is the only time you will see this secret. Store it securely - it cannot be
                recovered later.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client ID</label>
              <code className="block px-3 py-2 bg-slate-900 rounded text-sm font-mono text-slate-300">
                {clientId}
              </code>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Client Secret</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-sm font-mono text-emerald-400 break-all">
                  {secret}
                </code>
                <button
                  onClick={copySecret}
                  className="flex-shrink-0 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors flex items-center gap-2"
                >
                  {copied ? (
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
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            I&apos;ve saved the secret
          </button>
        </div>
      </div>
    </div>
  );
}
