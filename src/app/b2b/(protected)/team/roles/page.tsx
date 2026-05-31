"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { RoleEditorDialog, type RoleDraft } from "@/components/b2b/team/role-editor-dialog";

interface RoleRow extends RoleDraft { role_id: string; is_system: boolean; }

export default function RolesPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [editing, setEditing] = useState<RoleDraft | undefined>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/b2b/roles");
    const body = await res.json();
    setRows(res.ok ? body.data.items : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function restore() { await fetch("/api/b2b/roles/restore-system", { method: "POST" }); load(); }
  async function remove(role_id: string) {
    if (!confirm(t("pages.team.roles.deleteConfirm"))) return;
    const res = await fetch(`/api/b2b/roles/${role_id}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error);
    load();
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("pages.team.roles.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.team.roles.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1" onClick={restore}>{t("pages.team.roles.restoreSystem")}</button>
          <button className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => { setEditing(undefined); setOpen(true); }}>{t("pages.team.roles.create")}</button>
        </div>
      </div>

      {loading ? <p>{t("common.loading")}</p> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="py-2">{t("pages.team.roles.name")}</th><th>{t("pages.team.roles.permissions")}</th><th>{t("rbac.priceAccess.label")}</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.role_id} className="border-b">
                <td className="py-2">{r.name} {r.is_system && <span className="ml-1 rounded bg-muted px-1 text-xs">{t("pages.team.roles.system")}</span>}</td>
                <td>{r.permissions.length}</td>
                <td>{t(`rbac.priceAccess.${r.price_access}`)}</td>
                <td className="text-right">
                  <button className="text-primary hover:underline" onClick={() => { setEditing(r); setOpen(true); }}>{r.is_system ? t("common.view") : t("common.edit")}</button>
                  {!r.is_system && <button className="ml-3 text-destructive hover:underline" onClick={() => remove(r.role_id)}>{t("common.delete")}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RoleEditorDialog initial={editing} open={open} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}
