"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { AsyncMultiSelect } from "@/components/ui/async-multi-select";
import { PRICE_ACCESS_LEVELS } from "@/lib/auth/permissions/price-access";

interface RoleLite { role_id: string; name: string; scope: { channels: "all" | "per_user"; customers: "all" | "per_user" }; }
interface UserRow { _id: string; username: string; email: string; role_id?: string; isActive: boolean; price_access?: "none" | "view" | "edit"; scope_values?: { channels: "all" | string[]; customers: "all" | string[]; price_lists: "all" | string[] }; }

export function UserEditorDialog({ user, roles, open, onClose, onSaved }: { user?: UserRow; roles: RoleLite[]; open: boolean; onClose: () => void; onSaved: () => void; }) {
  const { t } = useTranslation();
  const [roleId, setRoleId] = useState("");
  const [active, setActive] = useState(true);
  const [price, setPrice] = useState("inherit");
  const [channels, setChannels] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [channelOpts, setChannelOpts] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setRoleId(user.role_id ?? "");
    setActive(user.isActive);
    setPrice(user.price_access ?? "inherit");
    setChannels(Array.isArray(user.scope_values?.channels) ? user.scope_values!.channels : []);
    setCustomers(Array.isArray(user.scope_values?.customers) ? user.scope_values!.customers : []);
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/b2b/channels").then((r) => r.json()).then((b) => {
      setChannelOpts((b.channels ?? []).map((c: { channel_id: string; name: string }) => ({ id: c.channel_id, label: c.name })));
    });
  }, [open]);

  if (!open || !user) return null;
  const role = roles.find((r) => r.role_id === roleId);
  const needsChannels = role?.scope.channels === "per_user";
  const needsCustomers = role?.scope.customers === "per_user";

  async function save() {
    setSaving(true);
    try {
      const payload = {
        role_id: roleId || null,
        isActive: active,
        price_access: price === "inherit" ? null : price,
        scope_values: { channels: needsChannels ? channels : "all", customers: needsCustomers ? customers : "all", price_lists: "all" },
      };
      const res = await fetch(`/api/b2b/users/${user!._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      onSaved(); onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-background p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">{user.username}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{user.email}</p>

        <label className="block text-sm font-medium">{t("pages.team.users.role")}</label>
        <select className="mb-3 w-full rounded border px-2 py-1" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">{t("pages.team.users.noRole")}</option>
          {roles.map((r) => <option key={r.role_id} value={r.role_id}>{r.name}</option>)}
        </select>

        {needsChannels && (
          <fieldset className="mb-3">
            <legend className="text-sm font-medium">{t("pages.team.users.channels")}</legend>
            {channelOpts.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={channels.includes(c.id)} onChange={() => setChannels((v) => v.includes(c.id) ? v.filter((x) => x !== c.id) : [...v, c.id])} />
                {c.label}
              </label>
            ))}
          </fieldset>
        )}

        {needsCustomers && (
          <div className="mb-3">
            <label className="block text-sm font-medium">{t("pages.team.users.customers")}</label>
            <AsyncMultiSelect value={customers} onChange={setCustomers} placeholder={t("pages.team.users.customers")}
              fetchPage={async (q, page) => {
                const r = await fetch(`/api/b2b/customers?search=${encodeURIComponent(q)}&page=${page}&limit=20`);
                const b = await r.json();
                return {
                  items: (b.customers ?? []).map((c: { customer_id: string; company_name?: string; email?: string }) => ({ id: c.customer_id, label: c.company_name || c.email || c.customer_id })),
                  hasMore: b.pagination ? b.pagination.page < b.pagination.pages : false,
                };
              }} />
          </div>
        )}

        <label className="block text-sm font-medium">{t("pages.team.users.priceOverride")}</label>
        <select className="mb-3 rounded border px-2 py-1" value={price} onChange={(e) => setPrice(e.target.value)}>
          <option value="inherit">{t("rbac.priceAccess.inherit")}</option>
          {PRICE_ACCESS_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(`rbac.priceAccess.${lvl}`)}</option>)}
        </select>

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t("pages.team.users.active")}
        </label>

        <div className="flex justify-end gap-2">
          <button className="rounded border px-3 py-1" onClick={onClose}>{t("common.cancel")}</button>
          <button className="rounded bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50" disabled={saving} onClick={save}>{t("common.save")}</button>
        </div>
      </div>
    </div>
  );
}
