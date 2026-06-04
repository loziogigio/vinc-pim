"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { UserEditorDialog } from "@/components/b2b/team/user-editor-dialog";

interface RoleLite { role_id: string; name: string; scope: { channels: "all" | "per_user"; customers: "all" | "per_user" }; }
interface UserRow { _id: string; username: string; email: string; role_id?: string; isActive: boolean; price_access?: "none" | "view" | "edit"; scope_values?: { channels: "all" | string[]; customers: "all" | string[]; price_lists: "all" | string[] }; }

export function UsersManager() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleLite[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserRow | undefined>();
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch(`/api/b2b/users?search=${encodeURIComponent(search)}&limit=50`),
      fetch("/api/b2b/roles"),
    ]);
    const uBody = await uRes.json();
    const rBody = await rRes.json();
    setRows(uRes.ok ? uBody.data.items : []);
    setRoles(rRes.ok ? rBody.data.items : []);
  }, [search]);
  useEffect(() => { load(); }, [load]);

  const roleName = (id?: string) => roles.find((r) => r.role_id === id)?.name ?? t("pages.team.users.noRole");

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("pages.team.users.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.team.users.subtitle")}</p>
        </div>
        <button className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => { setEditing(undefined); setOpen(true); }}>{t("pages.team.users.create")}</button>
      </div>

      <input className="mb-4 w-64 rounded border px-2 py-1 text-sm" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />

      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2">{t("pages.team.users.title")}</th><th>{t("pages.team.users.role")}</th><th>{t("pages.team.users.active")}</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u._id} className="border-b">
              <td className="py-2">{u.username}<div className="text-xs text-muted-foreground">{u.email}</div></td>
              <td>{roleName(u.role_id)}</td>
              <td>{u.isActive ? "✓" : "—"}</td>
              <td className="text-right"><button className="text-primary hover:underline" onClick={() => { setEditing(u); setOpen(true); }}>{t("common.edit")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <UserEditorDialog user={editing} roles={roles} open={open} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}
