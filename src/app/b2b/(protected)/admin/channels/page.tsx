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
import { useTranslation } from "@/lib/i18n/useTranslation";

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

const COLOR_SWATCH_KEYS = [
  { key: "colorNone", hex: "" },
  { key: "colorGray", hex: "#64748b" },
  { key: "colorBlue", hex: "#3b82f6" },
  { key: "colorGreen", hex: "#10b981" },
  { key: "colorPurple", hex: "#8b5cf6" },
  { key: "colorOrange", hex: "#f97316" },
  { key: "colorYellow", hex: "#f59e0b" },
  { key: "colorRed", hex: "#f43f5e" },
  { key: "colorTeal", hex: "#14b8a6" },
];

// ============================================================
// Main Page
// ============================================================

export default function ChannelsPage() {
  const { t } = useTranslation();
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
        setError(t("pages.admin.channels.loadError"));
      }
    } catch {
      setError(t("pages.admin.channels.connectionError"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

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
        setFormError(data.error ?? t("pages.admin.channels.saveError"));
      }
    } catch {
      setFormError(t("pages.admin.channels.connectionError"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(channel: SalesChannel) {
    if (channel.is_default) return;
    if (!confirm(t("pages.admin.channels.confirmDeactivate").replace("{name}", channel.name))) return;
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("pages.admin.channels.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("pages.admin.channels.subtitle")}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("pages.admin.channels.newChannel")}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-rose-50 text-rose-700 rounded-lg">{error}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Radio className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">{t("pages.admin.channels.noChannels")}</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("pages.admin.channels.createFirst")}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t("pages.admin.channels.channel")}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t("pages.admin.channels.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t("pages.admin.channels.default")}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">{t("pages.admin.channels.status")}</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {channels.map((channel) => (
                <tr key={channel.code} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: channel.color || "#94a3b8" }}
                      />
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {channel.code}
                      </code>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {channel.name}
                    {channel.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{channel.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {channel.is_default && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3" />
                        {t("pages.admin.channels.default")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                        channel.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {channel.is_active ? t("pages.admin.channels.active") : t("pages.admin.channels.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(channel)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title={t("common.edit")}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!channel.is_default && (
                        <button
                          onClick={() => handleDelete(channel)}
                          disabled={deletingCode === channel.code}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors disabled:opacity-50"
                          title={t("pages.admin.channels.deactivate")}
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
// Modal component (inline -- only used here)
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
  const { t } = useTranslation();

  function update<K extends keyof ChannelFormData>(key: K, value: ChannelFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const COLOR_SWATCHES = COLOR_SWATCH_KEYS.map((s) => ({
    label: t(`pages.admin.channels.${s.key}` as Parameters<typeof t>[0]),
    hex: s.hex,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? t("pages.admin.channels.editChannel") : t("pages.admin.channels.newChannel")}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.admin.channels.codeLabel")} <span className="text-rose-500">*</span>
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
              {t("pages.admin.channels.codeHelp")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.admin.channels.nameLabel")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="es. B2C Consumer, Slovakia"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.admin.channels.descriptionLabel")}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder={t("pages.admin.channels.descriptionPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t("pages.admin.channels.colorLabel")}
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

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => update("is_default", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">{t("pages.admin.channels.defaultChannel")}</span>
                <p className="text-xs text-slate-500">
                  {t("pages.admin.channels.defaultChannelDesc")}
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
                  <span className="text-sm font-medium text-slate-700">{t("pages.admin.channels.activeLabel")}</span>
                  <p className="text-xs text-slate-500">
                    {t("pages.admin.channels.activeDesc")}
                  </p>
                </div>
              </label>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !form.name.trim() || (!isEditing && !form.code.trim())}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? t("common.save") : t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
