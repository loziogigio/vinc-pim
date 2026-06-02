"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/data-models/slugify";
import { InstallErpSettingsButton } from "./install-erp-settings-button";
import type {
  DataModelCardinality,
  DataModelRelation,
  IDataModelDefinition,
} from "@/lib/db/models/data-model-definition";

type DefRow = Pick<
  IDataModelDefinition,
  | "_id"
  | "name"
  | "slug"
  | "relation"
  | "cardinality"
  | "channel"
  | "enabled"
  | "readable_by_end_user"
  | "fields"
  | "external_ref_field"
  | "created_at"
>;

export default function DataModelsPage() {
  const [items, setItems] = useState<DefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/b2b/data-models");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setItems(json.data.items as DefRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Database className="h-6 w-6 text-muted-foreground" />
            Data models
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define dynamic data collections attached to portal users or customers.
            Records are exposed via a generated CRUD API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && !items.some((i) => i.slug === "erp_settings") && (
            <InstallErpSettingsButton onInstalled={() => void load()} />
          )}
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New model
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Relation</th>
              <th className="px-3 py-2">Cardinality</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Fields</th>
              <th className="px-3 py-2">End-user</th>
              <th className="px-3 py-2">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No data models yet.
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row._id as string} className="hover:bg-muted/50">
                <td className="px-3 py-2 font-medium text-foreground">
                  <Link
                    href={`/b2b/admin/data-models/${row.slug}`}
                    className="hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {row.slug}
                </td>
                <td className="px-3 py-2">
                  <Badge>{row.relation}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={row.cardinality === "single" ? "blue" : "emerald"}>
                    {row.cardinality === "single" ? "1:1" : "1:N"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-foreground">{row.channel}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {(row.fields ?? []).length}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.readable_by_end_user ? "yes" : "no"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.enabled ? "yes" : "no"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewModelModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "blue" | "emerald";
}) {
  const cls =
    tone === "blue"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
      : tone === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function NewModelModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [relation, setRelation] = useState<DataModelRelation>("customer");
  const [cardinality, setCardinality] = useState<DataModelCardinality>("multiple");
  const [channel, setChannel] = useState("default");
  const [readableByEndUser, setReadableByEndUser] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setRelation("customer");
      setCardinality("multiple");
      setChannel("default");
      setReadableByEndUser(true);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/b2b/data-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          relation,
          cardinality,
          channel,
          readable_by_end_user: readableByEndUser,
          fields: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">New data model</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                if (!slug || slug === slugify(name)) setSlug(slugify(v));
              }}
              placeholder="Historical orders"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Slug (locked after save)
            </label>
            <Input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="historical_order"
              className="mt-1 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Relation</label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value as DataModelRelation)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="customer">customer</option>
                <option value="portal_user">portal_user</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cardinality</label>
              <select
                value={cardinality}
                onChange={(e) =>
                  setCardinality(e.target.value as DataModelCardinality)
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="multiple">multiple (1:N)</option>
                <option value="single">single (1:1)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Channel (SalesChannel code, or &quot;*&quot; for any)
            </label>
            <Input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="default"
              className="mt-1"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={readableByEndUser}
              onChange={(e) => setReadableByEndUser(e.target.checked)}
              className="rounded"
            />
            Readable by end users (storefront)
          </label>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-2 text-sm text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
