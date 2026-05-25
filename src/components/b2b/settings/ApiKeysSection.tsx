"use client";

/**
 * API keys section of the global B2B settings page.
 * Lifted from the legacy /b2b/home-settings page (`APIKeysForm`).
 *
 * Self-contained: it owns its own data via /api/b2b/api-keys
 * (GET list + available permissions, POST create, PATCH toggle active,
 * DELETE remove). It does NOT participate in the page's GET/POST
 * /api/b2b/home-settings flow, so it takes no props.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, Key, Copy, Check, Trash2, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { SectionCard } from "@/components/b2c/storefront-settings/section-card";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface APIKeyData {
  _id: string;
  key_id: string;
  name: string;
  permissions: string[];
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
  created_by: string;
}

interface APIKeyPermission {
  value: string;
  label: string;
  description: string;
}

export function ApiKeysSection() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKeyData[]>([]);
  const [permissions, setPermissions] = useState<APIKeyPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["*"]);
  const [isCreating, setIsCreating] = useState(false);

  const [createdKey, setCreatedKey] = useState<{ key_id: string; secret: string } | null>(null);
  const [copiedField, setCopiedField] = useState<"key" | "secret" | null>(null);

  const [keyToDelete, setKeyToDelete] = useState<APIKeyData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/b2b/api-keys");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("pages.b2bSettings.networkError"));
      }
      setKeys(data.keys || []);
      setPermissions(data.permissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bSettings.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/b2b/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim(), permissions: newKeyPermissions }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("pages.b2bSettings.networkError"));
      }
      setCreatedKey({ key_id: data.key.key_id, secret: data.secret });
      setShowCreateModal(false);
      setNewKeyName("");
      setNewKeyPermissions(["*"]);
      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bSettings.networkError"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (key: APIKeyData) => {
    try {
      const response = await fetch(`/api/b2b/api-keys/${key._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !key.is_active }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("pages.b2bSettings.networkError"));
      }
      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bSettings.networkError"));
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/b2b/api-keys/${keyToDelete._id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("pages.b2bSettings.networkError"));
      }
      setKeyToDelete(null);
      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2bSettings.networkError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async (text: string, field: "key" | "secret") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t("pages.homeSettings.apiKeys.never");
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SectionCard title={t("pages.homeSettings.apiKeys.title")} description={t("pages.homeSettings.apiKeys.description")}>
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {createdKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-amber-800">{t("pages.homeSettings.apiKeys.saveCredentials")}</h4>
                <p className="text-sm text-amber-700">{t("pages.homeSettings.apiKeys.secretWarning")}</p>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-amber-700">{t("pages.homeSettings.apiKeys.apiKey")}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono border border-amber-200">
                      {createdKey.key_id}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdKey.key_id, "key")}
                      className="shrink-0"
                    >
                      {copiedField === "key" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-amber-700">
                    {t("pages.homeSettings.apiKeys.apiSecret")}
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono border border-amber-200">
                      {createdKey.secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdKey.secret, "secret")}
                      className="shrink-0"
                    >
                      {copiedField === "secret" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreatedKey(null)}
                className="text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                {t("pages.homeSettings.apiKeys.savedCredentials")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t("pages.homeSettings.apiKeys.yourKeys")}</h3>
          <Button type="button" size="sm" onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("pages.homeSettings.apiKeys.createNewKey")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center">
            <Key className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-foreground/80">{t("pages.homeSettings.apiKeys.noKeysYet")}</p>
            <p className="text-xs text-muted-foreground">{t("pages.homeSettings.apiKeys.noKeysYetDesc")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key._id}
                className={cn(
                  "rounded-lg border p-4",
                  key.is_active ? "border-border bg-card" : "border-border bg-muted/50 opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{key.name}</h4>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          key.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-foreground/80"
                        )}
                      >
                        {key.is_active ? t("common.active") : t("common.inactive")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-mono text-muted-foreground truncate">{key.key_id}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {t("pages.homeSettings.apiKeys.created")}: {formatDate(key.created_at)}
                      </span>
                      <span>
                        {t("pages.homeSettings.apiKeys.lastUsed")}: {formatDate(key.last_used_at)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(key.permissions ?? []).map((perm) => (
                        <span key={perm} className="rounded bg-muted px-2 py-0.5 text-xs text-foreground/80">
                          {perm === "*" ? t("pages.homeSettings.apiKeys.fullAccess") : perm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(key)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        key.is_active ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          key.is_active ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setKeyToDelete(key)}
                      className="text-muted-foreground/60 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">{t("pages.homeSettings.apiKeys.createNewKey")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("pages.homeSettings.apiKeys.createNewKeyDesc")}</p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="key-name" className="text-sm font-medium text-foreground/80">
                  {t("pages.homeSettings.apiKeys.keyName")}
                </label>
                <input
                  id="key-name"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., ERP Integration"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">{t("pages.homeSettings.apiKeys.permissions")}</label>
                <div className="space-y-2">
                  {permissions.map((perm) => (
                    <label key={perm.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyPermissions.includes(perm.value)}
                        onChange={(e) => {
                          if (perm.value === "*") {
                            setNewKeyPermissions(e.target.checked ? ["*"] : []);
                          } else if (e.target.checked) {
                            setNewKeyPermissions((prev) => prev.filter((p) => p !== "*").concat(perm.value));
                          } else {
                            setNewKeyPermissions((prev) => prev.filter((p) => p !== perm.value));
                          }
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground/90">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName("");
                  setNewKeyPermissions(["*"]);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={handleCreateKey} disabled={!newKeyName.trim() || isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pages.homeSettings.apiKeys.creating")}
                  </>
                ) : (
                  t("pages.homeSettings.apiKeys.createKey")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {keyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-popover p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t("pages.homeSettings.apiKeys.deleteKey")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("pages.homeSettings.apiKeys.deleteKeyConfirm", { name: keyToDelete.name })}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setKeyToDelete(null)} disabled={isDeleting}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleDeleteKey}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pages.homeSettings.apiKeys.deleting")}
                  </>
                ) : (
                  t("pages.homeSettings.apiKeys.deleteKey")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
