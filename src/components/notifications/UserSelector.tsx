"use client";

import { useState } from "react";
import { X, Users, Building2, User, Download, Upload, Tag, FileText, Loader2 } from "lucide-react";
import { BrowseUsersTab, ImportUsersTab, TagsTab, type SelectedUser, type ApiUser } from "./user-selector";

export type { SelectedUser, UserType } from "./user-selector";

type ModalTab = "browse" | "import" | "export" | "tags";

interface UserSelectorProps {
  value: SelectedUser[];
  onChange: (users: SelectedUser[]) => void;
  disabled?: boolean;
}

export function UserSelector({ value, onChange, disabled }: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>("browse");
  const [isExporting, setIsExporting] = useState(false);

  const selectedIds = new Set(value.map((u) => u.id));
  const b2bCount = value.filter((u) => u.type === "b2b").length;
  const portalCount = value.filter((u) => u.type === "portal").length;

  const toggleUser = (user: ApiUser) => {
    const isSelected = value.some((u) => u.id === user.id);
    if (isSelected) {
      onChange(value.filter((u) => u.id !== user.id));
    } else {
      onChange([...value, { id: user.id, email: user.email, name: user.name, type: user.type }]);
    }
  };

  const removeUser = (userId: string) => {
    onChange(value.filter((u) => u.id !== userId));
  };

  const handleSelectAll = (users: ApiUser[]) => {
    const newUsers = users.filter((u) => !value.some((v) => v.id === u.id));
    onChange([...value, ...newUsers.map((u) => ({ id: u.id, email: u.email, name: u.name, type: u.type }))]);
  };

  const handleAddUsers = (users: SelectedUser[]) => {
    const existingIds = new Set(value.map((u) => u.id));
    const newUsers = users.filter((u) => !existingIds.has(u.id));
    onChange([...value, ...newUsers]);
  };

  const handleExport = async () => {
    if (value.length === 0) return;

    setIsExporting(true);
    try {
      const res = await fetch("/api/b2b/notifications/recipients/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: value.map((u) => u.id), format: "csv" }),
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

  return (
    <div className="relative">
      {/* Selected Users Summary */}
      {value.length > 0 && (
        <div className="mb-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">{value.length} destinatari selezionati</span>
            <button type="button" onClick={() => onChange([])} disabled={disabled} className="text-xs text-rose-600 hover:text-rose-700 disabled:opacity-50">
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
              <span key={user.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border text-xs">
                {user.name}
                <button type="button" onClick={() => removeUser(user.id)} disabled={disabled} className="hover:text-rose-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {value.length > 5 && <span className="px-2 py-1 text-xs text-slate-500">+{value.length - 5} altri</span>}
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
        <span className="text-sm">{value.length > 0 ? "Modifica destinatari" : "Seleziona destinatari"}</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Seleziona Destinatari</h3>
                  <p className="text-sm text-slate-500 mt-1">{value.length} selezionati</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
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
                      activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
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
              {activeTab === "browse" && (
                <BrowseUsersTab selectedUsers={value} onToggleUser={toggleUser} onSelectAll={handleSelectAll} />
              )}

              {activeTab === "import" && <ImportUsersTab onAddUsers={handleAddUsers} />}

              {activeTab === "tags" && <TagsTab existingUserIds={selectedIds} onAddUsers={handleAddUsers} />}

              {activeTab === "export" && (
                <div className="p-4">
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    {value.length > 0 ? (
                      <>
                        <p className="text-sm text-slate-600 mb-4">
                          Esporta {value.length} destinatar{value.length !== 1 ? "i" : "io"} selezionat{value.length !== 1 ? "i" : "o"} in formato CSV.
                        </p>
                        <button
                          onClick={handleExport}
                          disabled={isExporting}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          Scarica CSV
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">Seleziona almeno un destinatario per esportare.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {value.length} destinatar{value.length !== 1 ? "i" : "io"} selezionat{value.length !== 1 ? "i" : "o"}
              </p>
              <button onClick={() => setIsOpen(false)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition">
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
