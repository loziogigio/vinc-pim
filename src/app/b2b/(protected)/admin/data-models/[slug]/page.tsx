"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Database,
  Save,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldsEditor } from "@/components/data-models/FieldsEditor";
import { RecordsTable, type RecordDoc } from "@/components/data-models/RecordsTable";
import { RecordFormModal } from "@/components/data-models/RecordFormModal";
import { ImportPanel } from "@/components/data-models/ImportPanel";
import { ApiDocsPanel } from "@/components/data-models/ApiDocsPanel";
import {
  collectFieldSlugs,
  type DataModelField,
  type IDataModelDefinition,
} from "@/lib/db/models/data-model-definition";

type Tab = "schema" | "records" | "import" | "api";

export default function DataModelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("schema");

  const [definition, setDefinition] = useState<IDataModelDefinition | null>(null);
  const [draftFields, setDraftFields] = useState<DataModelField[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftReadable, setDraftReadable] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDefinition = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/b2b/data-models/${encodeURIComponent(slug)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      const def = json.data as IDataModelDefinition;
      setDefinition(def);
      setDraftFields((def.fields ?? []) as DataModelField[]);
      setDraftName(def.name);
      setDraftEnabled(def.enabled);
      setDraftReadable(def.readable_by_end_user);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadDefinition();
  }, [loadDefinition]);

  const lockedSlugs = useMemo(() => {
    if (!definition) return new Set<string>();
    return new Set(collectFieldSlugs(definition.fields ?? []));
  }, [definition]);

  const saveSchema = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/data-models/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName,
          enabled: draftEnabled,
          readable_by_end_user: draftReadable,
          fields: draftFields,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setDefinition(json.data as IDataModelDefinition);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = async () => {
    if (
      !confirm(
        `Delete model "${slug}"? Pass through if records exist — you'll be prompted again with the count.`
      )
    )
      return;
    setSaving(true);
    try {
      let res = await fetch(`/api/b2b/data-models/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      let json = await res.json();
      if (res.status === 409) {
        const count = json?.record_count ?? "some";
        if (!confirm(`This model has ${count} record(s). Drop the collection and delete?`)) {
          setSaving(false);
          return;
        }
        res = await fetch(
          `/api/b2b/data-models/${encodeURIComponent(slug)}?force=1`,
          { method: "DELETE" }
        );
        json = await res.json();
      }
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      router.push("/b2b/admin/data-models");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-muted-foreground">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!definition) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-3 text-sm text-rose-700 dark:text-rose-400">
          {error || "Not found"}
        </div>
        <Link
          href="/b2b/admin/data-models"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/b2b/admin/data-models"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All data models
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Database className="h-6 w-6 text-muted-foreground" />
            {definition.name}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {definition.slug} · relation: {definition.relation} · cardinality:{" "}
            {definition.cardinality} · channel: {definition.channel}
            {definition.external_ref_field
              ? ` · external_ref: ${definition.external_ref_field}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={deleteModel} disabled={saving}>
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {(["schema", "records", "import", "api"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize whitespace-nowrap ${
              tab === t
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {tab === "schema" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draftEnabled}
                  onChange={(e) => setDraftEnabled(e.target.checked)}
                  className="rounded"
                />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draftReadable}
                  onChange={(e) => setDraftReadable(e.target.checked)}
                  className="rounded"
                />
                Readable by end users
              </label>
            </div>
          </div>

          <FieldsEditor
            fields={draftFields}
            onChange={setDraftFields}
            lockedSlugs={lockedSlugs}
          />

          <div className="flex justify-end">
            <Button onClick={saveSchema} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving…" : "Save schema"}
            </Button>
          </div>
        </div>
      )}

      {tab === "records" && (
        <RecordsTab definition={definition} />
      )}

      {tab === "import" && (
        <ImportPanel slug={definition.slug} />
      )}

      {tab === "api" && (
        <ApiDocsPanel definition={definition} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Records tab — list + add/edit/delete
// -----------------------------------------------------------------

function RecordsTab({ definition }: { definition: IDataModelDefinition }) {
  const [records, setRecords] = useState<RecordDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<RecordDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [relationFilter, setRelationFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (relationFilter.trim()) params.set("relation_id", relationFilter.trim());
      const res = await fetch(
        `/api/b2b/data-models/${encodeURIComponent(definition.slug)}/records?${params.toString()}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setRecords(json.data.items as RecordDoc[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [definition.slug, relationFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRecord = async (input: {
    relation_id: string;
    channel: string;
    data: Record<string, unknown>;
  }) => {
    setModalBusy(true);
    setModalError(null);
    try {
      const url = editing
        ? `/api/b2b/data-models/${encodeURIComponent(definition.slug)}/records/${editing._id}`
        : `/api/b2b/data-models/${encodeURIComponent(definition.slug)}/records`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? { data: input.data }
            : { relation_id: input.relation_id, channel: input.channel, data: input.data }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setEditing(null);
      setCreating(false);
      await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setModalBusy(false);
    }
  };

  const deleteRecord = async (rec: RecordDoc) => {
    if (!confirm(`Delete record ${rec._id}?`)) return;
    try {
      const res = await fetch(
        `/api/b2b/data-models/${encodeURIComponent(definition.slug)}/records/${rec._id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={relationFilter}
          onChange={(e) => setRelationFilter(e.target.value)}
          placeholder={`Filter by ${definition.relation} id (e.g. ${
            definition.relation === "customer" ? "C-…" : "PU-…"
          })`}
          className="w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add record
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading records…
        </p>
      )}

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {!loading && (
        <RecordsTable
          fields={(definition.fields ?? []) as DataModelField[]}
          records={records}
          onEdit={(rec) => setEditing(rec)}
          onDelete={deleteRecord}
        />
      )}

      <RecordFormModal
        open={creating || editing !== null}
        title={editing ? `Edit record · ${editing._id.slice(-8)}` : "Add record"}
        fields={(definition.fields ?? []) as DataModelField[]}
        definitionChannel={definition.channel}
        initial={
          editing
            ? {
                relation_id: editing.relation_id,
                channel: editing.channel,
                data: editing.data,
              }
            : undefined
        }
        busy={modalBusy}
        error={modalError}
        onClose={() => {
          setEditing(null);
          setCreating(false);
          setModalError(null);
        }}
        onSubmit={submitRecord}
      />
    </div>
  );
}
