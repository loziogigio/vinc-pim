"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { FullScreenModal } from "@/components/shared/FullScreenModal";
import { FormBlockSettings } from "@/components/builder/FormBlockSettings";
import type { FormBlockConfig } from "@/lib/types/blocks";

interface FormDefinition {
  _id: string;
  storefront_slug: string;
  slug: string;
  name: string;
  config: FormBlockConfig;
  notification_emails: string[];
  send_submitter_copy: boolean;
  is_system: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const DEFAULT_CONFIG: FormBlockConfig = {
  variant: "form",
  fields: [],
  title: "",
  description: "",
  submit_button_text: "",
  success_message: "",
};

interface FormDefinitionsTabProps {
  storefrontSlug: string;
}

export function FormDefinitionsTab({ storefrontSlug }: FormDefinitionsTabProps) {
  const { t } = useTranslation();
  const [definitions, setDefinitions] = useState<FormDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<FormDefinition | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formConfig, setFormConfig] = useState<FormBlockConfig>(DEFAULT_CONFIG);
  const [formEmails, setFormEmails] = useState<string[]>([]);
  const [formSenderCopy, setFormSenderCopy] = useState(false);

  const apiBase = `/api/b2b/b2c/storefronts/${storefrontSlug}/form-definitions`;

  const fetchDefinitions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${apiBase}?limit=50`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setDefinitions(json.data?.items || []);
    } catch {
      setError(t("pages.b2c.formDefinitions.failedToLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, t]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const openCreateModal = () => {
    setEditingDef(null);
    setFormName("");
    setFormSlug("");
    setFormEnabled(true);
    setFormConfig(DEFAULT_CONFIG);
    setFormEmails([]);
    setFormSenderCopy(false);
    setModalOpen(true);
  };

  const openEditModal = (def: FormDefinition) => {
    setEditingDef(def);
    setFormName(def.name);
    setFormSlug(def.slug);
    setFormEnabled(def.enabled);
    setFormConfig(def.config || DEFAULT_CONFIG);
    setFormEmails(def.notification_emails || []);
    setFormSenderCopy(def.send_submitter_copy);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: formName,
        slug: formSlug || toSlug(formName),
        config: formConfig,
        notification_emails: formEmails.filter((e) => e.trim()),
        send_submitter_copy: formSenderCopy,
        enabled: formEnabled,
      };

      const isEdit = !!editingDef;
      const url = isEdit ? `${apiBase}/${editingDef.slug}` : apiBase;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save");
      }

      setModalOpen(false);
      await fetchDefinitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.b2c.formDefinitions.failedToSave"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (def: FormDefinition) => {
    if (def.is_system) return;
    if (!confirm(t("pages.b2c.formDefinitions.deleteConfirm"))) return;

    try {
      const res = await fetch(`${apiBase}/${def.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchDefinitions();
    } catch {
      setError(t("pages.b2c.formDefinitions.failedToDelete"));
    }
  };

  const addEmail = () => setFormEmails([...formEmails, ""]);
  const removeEmail = (idx: number) => setFormEmails(formEmails.filter((_, i) => i !== idx));
  const updateEmail = (idx: number, value: string) =>
    setFormEmails(formEmails.map((e, i) => (i === idx ? value : e)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
      </div>
    );
  }

  const isSystemForm = editingDef?.is_system ?? false;

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#b9b9c3]">
          {t("pages.b2c.formDefinitions.subtitle").replace("{slug}", storefrontSlug)}
        </p>
        <Button onClick={openCreateModal} size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("pages.b2c.formDefinitions.create")}
        </Button>
      </div>

      {/* Empty state */}
      {definitions.length === 0 && (
        <div className="rounded-[0.428rem] border border-dashed border-[#ebe9f1] bg-[#fafafc] px-6 py-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-[#b9b9c3] mb-3" />
          <p className="text-sm text-[#b9b9c3]">{t("pages.b2c.formDefinitions.noDefinitions")}</p>
        </div>
      )}

      {/* Table */}
      {definitions.length > 0 && (
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafc]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                  {t("pages.b2c.formDefinitions.name")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                  {t("pages.b2c.formDefinitions.slug")}
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#5e5873]">
                  {t("pages.b2c.formDefinitions.recipients")}
                </th>
                <th className="px-4 py-3 text-center font-medium text-[#5e5873]">
                  {t("pages.b2c.formDefinitions.enabled")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#5e5873]">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe9f1]">
              {definitions.map((def) => (
                <tr key={def._id} className="hover:bg-[#fafafc]">
                  <td className="px-4 py-3 text-[#5e5873] font-medium">
                    <div className="flex items-center gap-2">
                      {def.name}
                      {def.is_system && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          <Lock className="h-2.5 w-2.5" />
                          {t("pages.b2c.formDefinitions.system")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#b9b9c3] font-mono text-xs">{def.slug}</td>
                  <td className="px-4 py-3 text-[#b9b9c3]">
                    {def.notification_emails.length || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        def.enabled ? "bg-green-500" : "bg-slate-300"
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(def)}
                        className="inline-flex items-center gap-1 text-sm text-[#009688] hover:text-[#00796b] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t("common.edit")}
                      </button>
                      {!def.is_system && (
                        <button
                          type="button"
                          onClick={() => handleDelete(def)}
                          className="rounded-md p-1.5 text-[#b9b9c3] hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create/Edit Modal */}
      <FullScreenModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDef ? t("pages.b2c.formDefinitions.edit") : t("pages.b2c.formDefinitions.create")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-8">
          {/* Name & Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                {t("pages.b2c.formDefinitions.name")}
              </label>
              <Input
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!editingDef) setFormSlug(toSlug(e.target.value));
                }}
                placeholder="Order Note"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                {t("pages.b2c.formDefinitions.slug")}
              </label>
              <Input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="order-note"
                className="mt-2"
                disabled={isSystemForm}
              />
            </div>
          </div>

          {/* Enabled */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formEnabled}
              onChange={(e) => setFormEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#009688] focus:ring-[#009688]"
            />
            <span className="text-sm font-medium text-slate-700">
              {t("pages.b2c.formDefinitions.enabled")}
            </span>
          </label>

          {/* Form Builder — hide fields for system forms like order_note */}
          {!isSystemForm && (
            <div className="rounded-lg border border-slate-200 p-4">
              <FormBlockSettings config={formConfig} onChange={setFormConfig} />
            </div>
          )}

          {/* Notification Emails */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  {t("pages.b2c.formDefinitions.recipients")}
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("pages.b2c.formDefinitions.recipientsDesc")}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("pages.b2c.formDefinitions.addEmail")}
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {formEmails.map((email, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(idx, e.target.value)}
                    placeholder="admin@example.com"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEmail(idx)}
                    className="h-9 w-9 p-0 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {formEmails.length === 0 && (
                <p className="text-sm text-slate-400 italic">
                  {t("pages.b2c.formDefinitions.addEmail")}
                </p>
              )}
            </div>
          </div>

          {/* Send Submitter Copy */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formSenderCopy}
              onChange={(e) => setFormSenderCopy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#009688] focus:ring-[#009688]"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">
                {t("pages.b2c.formDefinitions.senderCopy")}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("pages.b2c.formDefinitions.senderCopyDesc")}
              </p>
            </div>
          </label>
        </div>
      </FullScreenModal>
    </>
  );
}
