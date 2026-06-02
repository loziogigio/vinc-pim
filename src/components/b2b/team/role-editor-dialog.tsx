"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { PERMISSIONS, ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/permissions/catalog";
import { PRICE_ACCESS_LEVELS } from "@/lib/auth/permissions/price-access";

export interface RoleDraft {
  role_id?: string;
  name: string;
  description?: string;
  is_system?: boolean;
  permissions: PermissionKey[];
  scope: { channels: "all" | "per_user"; customers: "all" | "per_user"; price_lists: "all" | "per_user" };
  price_access: "none" | "view" | "edit";
}

const EMPTY: RoleDraft = { name: "", description: "", permissions: [], scope: { channels: "all", customers: "all", price_lists: "all" }, price_access: "none" };

const BY_APP: Record<string, PermissionKey[]> = ALL_PERMISSION_KEYS.reduce((acc, k) => {
  (acc[PERMISSIONS[k].app] ||= []).push(k);
  return acc;
}, {} as Record<string, PermissionKey[]>);

export function RoleEditorDialog({ initial, open, onClose, onSaved }: { initial?: RoleDraft; open: boolean; onClose: () => void; onSaved: () => void; }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<RoleDraft>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(initial ?? EMPTY); }, [initial, open]);
  if (!open) return null;
  const readOnly = !!draft.is_system;

  function togglePerm(k: PermissionKey) {
    setDraft((d) => ({ ...d, permissions: d.permissions.includes(k) ? d.permissions.filter((p) => p !== k) : [...d.permissions, k] }));
  }
  async function save() {
    setSaving(true);
    try {
      const method = draft.role_id ? "PATCH" : "POST";
      const url = draft.role_id ? `/api/b2b/roles/${draft.role_id}` : "/api/b2b/roles";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-background p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">{draft.role_id ? t("pages.team.roles.edit") : t("pages.team.roles.create")}</h2>

        <label className="block text-sm font-medium">{t("pages.team.roles.name")}</label>
        <input className="mb-3 w-full rounded border px-2 py-1" disabled={readOnly} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />

        <label className="block text-sm font-medium">{t("pages.team.roles.description")}</label>
        <input className="mb-3 w-full rounded border px-2 py-1" disabled={readOnly} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />

        <fieldset className="mb-3">
          <legend className="text-sm font-medium">{t("pages.team.roles.permissions")}</legend>
          {Object.entries(BY_APP).map(([app, keys]) => (
            <div key={app} className="mt-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">{app}</div>
              {keys.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={readOnly} checked={draft.permissions.includes(k)} onChange={() => togglePerm(k)} />
                  {t(PERMISSIONS[k].i18nKey)}
                </label>
              ))}
            </div>
          ))}
        </fieldset>

        <fieldset className="mb-3">
          <legend className="text-sm font-medium">{t("pages.team.roles.scope")}</legend>
          {(["channels", "customers"] as const).map((dim) => (
            <div key={dim} className="mt-1 flex items-center gap-3 text-sm">
              <span className="w-24">{t(`pages.team.users.${dim}`)}</span>
              {(["all", "per_user"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-1">
                  <input type="radio" disabled={readOnly} name={`scope-${dim}`} checked={draft.scope[dim] === mode} onChange={() => setDraft({ ...draft, scope: { ...draft.scope, [dim]: mode } })} />
                  {mode === "all" ? t("pages.team.roles.scopeAll") : t("pages.team.roles.scopePerUser")}
                </label>
              ))}
            </div>
          ))}
        </fieldset>

        <label className="block text-sm font-medium">{t("rbac.priceAccess.label")}</label>
        <select className="mb-4 rounded border px-2 py-1" disabled={readOnly} value={draft.price_access} onChange={(e) => setDraft({ ...draft, price_access: e.target.value as RoleDraft["price_access"] })}>
          {PRICE_ACCESS_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(`rbac.priceAccess.${lvl}`)}</option>)}
        </select>

        <div className="flex justify-end gap-2">
          <button className="rounded border px-3 py-1" onClick={onClose}>{t("common.cancel")}</button>
          {!readOnly && <button className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50" disabled={saving || !draft.name.trim()} onClick={save}>{t("common.save")}</button>}
        </div>
      </div>
    </div>
  );
}
