"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  X,
  Users,
  Building2,
  User,
  Loader2,
  Check,
  AlertTriangle,
  Upload,
  Download,
  Tag,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

export type UserType = "b2b" | "portal";

export interface SelectedUser {
  id: string;
  email: string;
  name: string;
  type: UserType;
}

type ApiUser = {
  id: string;
  email: string;
  name: string;
  type: UserType;
  role?: string;
};

type UserTag = {
  tag_id: string;
  name: string;
  slug: string;
  color?: string;
  user_count: number;
};

type ModalTab = "browse" | "import" | "export" | "tags";

type Props = {
  value: SelectedUser[];
  onChange: (users: SelectedUser[]) => void;
  disabled?: boolean;
};

export function UserSelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>("browse");
  const [userType, setUserType] = useState<UserType>("b2b");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  // Import state
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{
    matched: SelectedUser[];
    not_found: string[];
    duplicates: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Tags state
  const [tags, setTags] = useState<UserTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load users when modal opens or search/type changes
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = userType === "b2b" ? "/api/b2b/users/list" : "/api/b2b/portal-users";
      const params = new URLSearchParams({
        limit: "50",
        ...(debouncedSearch && { search: debouncedSearch }),
      });

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();

        if (userType === "b2b") {
          setUsers(data.users || []);
        } else {
          const portalUsers = (data.portal_users || []).map((u: {
            portal_user_id: string;
            username: string;
            email: string;
            is_active?: boolean;
          }) => ({
            id: u.portal_user_id,
            name: u.username,
            email: u.email,
            type: "portal" as UserType,
          }));
          setUsers(portalUsers);
        }
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [userType, debouncedSearch]);

  // Load tags
  const loadTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      const res = await fetch("/api/b2b/user-tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error("Error loading tags:", error);
      setTags([]);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === "browse") {
      loadUsers();
    }
  }, [isOpen, activeTab, loadUsers]);

  useEffect(() => {
    if (isOpen && activeTab === "tags") {
      loadTags();
    }
  }, [isOpen, activeTab, loadTags]);

  // Import usernames
  const handleImport = async () => {
    if (!importText.trim()) return;

    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/b2b/notifications/recipients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importText }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult({
          matched: data.matched.map((u: { portal_user_id: string; username: string; email: string }) => ({
            id: u.portal_user_id,
            name: u.username,
            email: u.email,
            type: "portal" as UserType,
          })),
          not_found: data.not_found,
          duplicates: data.duplicates,
        });
      }
    } catch (error) {
      console.error("Error importing:", error);
    } finally {
      setIsImporting(false);
    }
  };

  // Add imported users
  const addImportedUsers = () => {
    if (!importResult) return;
    const existingIds = new Set(value.map((u) => u.id));
    const newUsers = importResult.matched.filter((u) => !existingIds.has(u.id));
    onChange([...value, ...newUsers]);
    setImportText("");
    setImportResult(null);
  };

  // Export selected users
  const handleExport = async () => {
    if (value.length === 0) return;

    setIsExporting(true);
    try {
      const res = await fetch("/api/b2b/notifications/recipients/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_ids: value.map((u) => u.id),
          format: "csv",
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recipients_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error exporting:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Add users by tags
  const addUsersByTags = async () => {
    if (selectedTagIds.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/notifications/recipients/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tag_ids: selectedTagIds,
          format: "json",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const existingIds = new Set(value.map((u) => u.id));
        const newUsers = (data.users || [])
          .filter((u: { portal_user_id: string }) => !existingIds.has(u.portal_user_id))
          .map((u: { portal_user_id: string; username: string; email: string }) => ({
            id: u.portal_user_id,
            name: u.username,
            email: u.email,
            type: "portal" as UserType,
          }));

        onChange([...value, ...newUsers]);
        setSelectedTagIds([]);
      }
    } catch (error) {
      console.error("Error loading users by tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUser = (user: ApiUser) => {
    const isSelected = value.some((u) => u.id === user.id);

    if (isSelected) {
      onChange(value.filter((u) => u.id !== user.id));
    } else {
      onChange([
        ...value,
        {
          id: user.id,
          email: user.email,
          name: user.name,
          type: user.type,
        },
      ]);
    }
  };

  const removeUser = (userId: string) => {
    onChange(value.filter((u) => u.id !== userId));
  };

  const selectAll = () => {
    const newUsers = users.filter((u) => !value.some((v) => v.id === u.id));
    onChange([
      ...value,
      ...newUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        type: u.type,
      })),
    ]);
    setShowConfirmAll(false);
  };

  const clearAll = () => {
    onChange([]);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const selectedIds = new Set(value.map((u) => u.id));
  const b2bCount = value.filter((u) => u.type === "b2b").length;
  const portalCount = value.filter((u) => u.type === "portal").length;

  return (
    <div className="relative">
      {/* Selected Users Summary */}
      {value.length > 0 && (
        <div className="mb-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              {value.length} destinatari selezionati
            </span>
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              Rimuovi tutti
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {b2bCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
                <Building2 className="w-3 h-3" />
                {b2bCount} B2B
              </span>
            )}
            {portalCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs">
                <User className="w-3 h-3" />
                {portalCount} Portal
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {value.slice(0, 5).map((user) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border text-xs"
              >
                {user.name}
                <button
                  type="button"
                  onClick={() => removeUser(user.id)}
                  disabled={disabled}
                  className="hover:text-rose-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {value.length > 5 && (
              <span className="px-2 py-1 text-xs text-slate-500">
                +{value.length - 5} altri
              </span>
            )}
          </div>
        </div>
      )}

      {/* Add Users Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 transition disabled:opacity-50"
      >
        <Users className="w-4 h-4" />
        <span className="text-sm">
          {value.length > 0 ? "Modifica destinatari" : "Seleziona destinatari"}
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Seleziona Destinatari
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {value.length} selezionati
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Tabs */}
              <div className="flex gap-1 border-b border-slate-100 -mx-6 px-6">
                {[
                  { id: "browse" as ModalTab, label: "Sfoglia", icon: Users },
                  { id: "import" as ModalTab, label: "Importa", icon: Upload },
                  { id: "tags" as ModalTab, label: "Tag", icon: Tag },
                  { id: "export" as ModalTab, label: "Esporta", icon: Download },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Browse Tab */}
              {activeTab === "browse" && (
                <div className="p-4">
                  {/* User Type Tabs */}
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setUserType("b2b");
                        setSearchQuery("");
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                        userType === "b2b"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      Utenti B2B
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserType("portal");
                        setSearchQuery("");
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                        userType === "portal"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Clienti Portal
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cerca per nome o email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none"
                    />
                  </div>

                  {/* User List */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-slate-500">Caricamento...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">
                        {searchQuery ? "Nessun utente trovato" : "Nessun utente disponibile"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs text-slate-500">
                          {total} {userType === "b2b" ? "utenti B2B" : "clienti"} totali
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowConfirmAll(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          Seleziona tutti visibili
                        </button>
                      </div>

                      {users.map((user) => {
                        const isSelected = selectedIds.has(user.id);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleUser(user)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center h-5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 rounded border-slate-300 text-primary"
                              />
                            </div>
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                user.type === "b2b" ? "bg-blue-100" : "bg-emerald-100"
                              }`}
                            >
                              {user.type === "b2b" ? (
                                <Building2 className="w-4 h-4 text-blue-600" />
                              ) : (
                                <User className="w-4 h-4 text-emerald-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {user.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {user.email}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Import Tab */}
              {activeTab === "import" && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Incolla i nomi utente (uno per riga o separati da virgola)
                    </label>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="utente1&#10;utente2&#10;utente3"
                      rows={8}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none resize-none font-mono text-sm"
                    />
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={!importText.trim() || isImporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Cerca utenti
                  </button>

                  {/* Import Results */}
                  {importResult && (
                    <div className="space-y-3">
                      {/* Matched */}
                      {importResult.matched.length > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-700">
                              {importResult.matched.length} utenti trovati
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {importResult.matched.slice(0, 10).map((u) => (
                              <span
                                key={u.id}
                                className="px-2 py-1 rounded bg-white text-xs"
                              >
                                {u.name}
                              </span>
                            ))}
                            {importResult.matched.length > 10 && (
                              <span className="px-2 py-1 text-xs text-emerald-600">
                                +{importResult.matched.length - 10} altri
                              </span>
                            )}
                          </div>
                          <button
                            onClick={addImportedUsers}
                            className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
                          >
                            Aggiungi {importResult.matched.length} utenti
                          </button>
                        </div>
                      )}

                      {/* Not Found */}
                      {importResult.not_found.length > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700">
                              {importResult.not_found.length} non trovati
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {importResult.not_found.slice(0, 10).map((name, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 rounded bg-white text-xs text-amber-700"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tags Tab */}
              {activeTab === "tags" && (
                <div className="p-4">
                  <p className="text-sm text-slate-500 mb-4">
                    Seleziona uno o più tag per aggiungere tutti gli utenti associati.
                  </p>

                  {isLoadingTags ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-slate-500">Caricamento tag...</span>
                    </div>
                  ) : tags.length === 0 ? (
                    <div className="text-center py-12">
                      <Tag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">Nessun tag disponibile</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Crea tag dalla sezione Impostazioni → Tag Utenti
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tags.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag.tag_id);
                        return (
                          <button
                            key={tag.tag_id}
                            type="button"
                            onClick={() => toggleTag(tag.tag_id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center h-5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 rounded border-slate-300 text-primary"
                              />
                            </div>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: tag.color
                                  ? `${tag.color}20`
                                  : "rgb(241, 245, 249)",
                              }}
                            >
                              <Tag
                                className="w-4 h-4"
                                style={{ color: tag.color || "#64748b" }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900">
                                {tag.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {tag.user_count} utent{tag.user_count !== 1 ? "i" : "e"}
                              </p>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}

                      {selectedTagIds.length > 0 && (
                        <button
                          onClick={addUsersByTags}
                          disabled={isLoading}
                          className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                          Aggiungi utenti da {selectedTagIds.length} tag
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Export Tab */}
              {activeTab === "export" && (
                <div className="p-4">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    {value.length > 0 ? (
                      <>
                        <p className="text-sm text-slate-600 mb-4">
                          Esporta {value.length} destinatar{value.length !== 1 ? "i" : "io"}{" "}
                          selezionat{value.length !== 1 ? "i" : "o"} in formato CSV.
                        </p>
                        <button
                          onClick={handleExport}
                          disabled={isExporting}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isExporting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Scarica CSV
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Seleziona almeno un destinatario per esportare.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {value.length} destinatar{value.length !== 1 ? "i" : "io"} selezionat
                {value.length !== 1 ? "i" : "o"}
              </p>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
              >
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Select All Modal */}
      {showConfirmAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Conferma selezione</h4>
                <p className="text-sm text-slate-500">
                  Stai per selezionare {users.length} {userType === "b2b" ? "utenti" : "clienti"}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Questa azione aggiungerà tutti gli utenti visibili alla lista dei destinatari.
              Continuare?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmAll(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                onClick={selectAll}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
