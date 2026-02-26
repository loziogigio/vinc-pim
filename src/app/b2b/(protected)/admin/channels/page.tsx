"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Radio,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Star,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface SalesChannel {
  _id: string;
  channel_id: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface ChannelFormData {
  code: string;
  name: string;
  description: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_FORM: ChannelFormData = {
  code: "",
  name: "",
  description: "",
  color: "",
  is_default: false,
  is_active: true,
};

const COLOR_SWATCHES = [
  { label: "Nessuno", hex: "" },
  { label: "Grigio", hex: "#64748b" },
  { label: "Blu", hex: "#3b82f6" },
  { label: "Verde", hex: "#10b981" },
  { label: "Viola", hex: "#8b5cf6" },
  { label: "Arancione", hex: "#f97316" },
  { label: "Giallo", hex: "#f59e0b" },
  { label: "Rosso", hex: "#f43f5e" },
  { label: "Teal", hex: "#14b8a6" },
];

// ============================================================
// Main Page
// ============================================================

export default function ChannelsPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SalesChannel | null>(null);
  const [form, setForm] = useState<ChannelFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b/channels?include_inactive=true");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      } else {
        setError("Impossibile caricare i canali");
      }
    } catch {
      setError("Errore di connessione");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // ---- Modal helpers ----

  function openCreate() {
    setEditingChannel(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(channel: SalesChannel) {
    setEditingChannel(channel);
    setForm({
      code: channel.code,
      name: channel.name,
      description: channel.description ?? "",
      color: channel.color ?? "",
      is_default: channel.is_default,
      is_active: channel.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingChannel(null);
    setFormError(null);
  }

  // ---- Save ----

  async function handleSave() {
    setIsSaving(true);
    setFormError(null);
    try {
      let res: Response;
      if (editingChannel) {
        res = await fetch(`/api/b2b/channels/${editingChannel.code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description || undefined,
            color: form.color || undefined,
            is_default: form.is_default,
            is_active: form.is_active,
          }),
        });
      } else {
        res = await fetch("/api/b2b/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: form.code,
            name: form.name,
            description: form.description || undefined,
            color: form.color || undefined,
            is_default: form.is_default,
          }),
        });
      }

      const data = await res.json();
      if (res.ok) {
        closeModal();
        loadChannels();
      } else {
        setFormError(data.error ?? "Errore nel salvataggio");
      }
    } catch {
      setFormError("Errore di connessione");
    } finally {
      setIsSaving(false);
    }
  }

  // ---- Delete (soft) ----

  async function handleDelete(channel: SalesChannel) {
    if (channel.is_default) return;
    if (!confirm(`Disattivare il canale "${channel.name}"?`)) return;
    setDeletingCode(channel.code);
    try {
      const res = await fetch(`/api/b2b/channels/${channel.code}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadChannels();
      }
    } catch {
      // ignore
    } finally {
      setDeletingCode(null);
    }
  }

  // ---- Render ----

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Canali di Vendita</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestisci i canali per clienti, utenti portale e prodotti
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuovo Canale
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-4 bg-rose-50 text-rose-700 rounded-lg">{error}</div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : channels.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Radio className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">Nessun canale configurato</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crea il primo canale
          </button>
        </div>
      ) : (
        /* Channel table */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Canale</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Default</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Stato</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {channels.map((channel) => (
                <tr key={channel.code} className="hover:bg-slate-50">
                  {/* Code + color dot */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: channel.color || "#94a3b8",
                        }}
                      />
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {channel.code}
                      </code>
                    </div>
                  </td>

                  {/* Name + description */}
                  <td className="px-4 py-3 text-slate-900">
                    {channel.name}
                    {channel.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{channel.description}</p>
                    )}
                  </td>

                  {/* Default badge */}
                  <td className="px-4 py-3">
                    {channel.is_default && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3" />
                        Default
                      </span>
                    )}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                        channel.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {channel.is_active ? "Attivo" : "Inattivo"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(channel)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title="Modifica"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!channel.is_default && (
                        <button
                          onClick={() => handleDelete(channel)}
                          disabled={deletingCode === channel.code}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors disabled:opacity-50"
                          title="Disattiva"
                        >
                          {deletingCode === channel.code ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <ChannelModal
          form={form}
          setForm={setForm}
          isEditing={!!editingChannel}
          isSaving={isSaving}
          error={formError}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal component (inline — only used here)
// ============================================================

interface ChannelModalProps {
  form: ChannelFormData;
  setForm: (updater: (prev: ChannelFormData) => ChannelFormData) => void;
  isEditing: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}

function ChannelModal({
  form,
  setForm,
  isEditing,
  isSaving,
  error,
  onSave,
  onClose,
}: ChannelModalProps) {
  function update<K extends keyof ChannelFormData>(key: K, value: ChannelFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? "Modifica Canale" : "Nuovo Canale"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Code (readonly on edit) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Codice <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => update("code", e.target.value.toLowerCase())}
              disabled={isEditing}
              placeholder="es. b2c, slovakia, ebay"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Lettere minuscole e trattini (es. <code>b2c</code>, <code>slovakia</code>). Non modificabile dopo la creazione.
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="es. B2C Consumer, Slovakia"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Descrizione
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Descrizione opzionale..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Color swatches */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Colore
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => update("color", swatch.hex)}
                  title={swatch.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.color === swatch.hex
                      ? "border-orange-500 scale-110"
                      : "border-transparent hover:border-slate-300"
                  } ${!swatch.hex ? "bg-slate-100 border-slate-200" : ""}`}
                  style={swatch.hex ? { backgroundColor: swatch.hex } : undefined}
                >
                  {!swatch.hex && (
                    <span className="text-slate-400 text-xs leading-none">✕</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => update("is_default", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Canale di default</span>
                <p className="text-xs text-slate-500">
                  Assegnato automaticamente a nuovi clienti e utenti portale
                </p>
              </div>
            </label>

            {isEditing && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => update("is_active", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Attivo</span>
                  <p className="text-xs text-slate-500">
                    I canali inattivi non appaiono nei selettori
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !form.name.trim() || (!isEditing && !form.code.trim())}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? "Salva" : "Crea"}
          </button>
        </div>
      </div>
    </div>
  );
}
