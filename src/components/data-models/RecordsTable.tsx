"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DataModelField } from "@/lib/db/models/data-model-definition";

export interface RecordDoc {
  _id: string;
  relation_id: string;
  channel: string;
  external_ref?: string;
  data: Record<string, unknown>;
  source?: string;
  imported_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface RecordsTableProps {
  fields: DataModelField[];
  records: RecordDoc[];
  locale?: string;
  onEdit?: (rec: RecordDoc) => void;
  onDelete?: (rec: RecordDoc) => void;
}

const MAX_COLUMNS = 5;

export function RecordsTable({
  fields,
  records,
  locale = "en",
  onEdit,
  onDelete,
}: RecordsTableProps) {
  // Pick the first N renderable top-level fields as columns. Skip object /
  // array_of_objects — they'd blow up the row layout; admins can drill into
  // a record's detail / JSON to see those.
  const columns = fields
    .filter((f) => f.type !== "object" && f.type !== "array_of_objects")
    .slice(0, MAX_COLUMNS);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Relation</th>
            <th className="px-3 py-2">Channel</th>
            {columns.map((c) => (
              <th key={c.slug} className="px-3 py-2">
                {c.label || c.slug}
              </th>
            ))}
            <th className="px-3 py-2">Imported</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {records.map((rec) => (
            <tr key={rec._id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-xs text-slate-700">
                {rec.relation_id}
              </td>
              <td className="px-3 py-2 text-slate-600">{rec.channel}</td>
              {columns.map((c) => (
                <td key={c.slug} className="px-3 py-2">
                  {renderCell(rec.data?.[c.slug], c, locale)}
                </td>
              ))}
              <td className="px-3 py-2 text-xs text-slate-500">
                {rec.imported_at
                  ? new Date(rec.imported_at).toLocaleString()
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(rec)}
                    className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(rec)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 4}
                className="px-3 py-8 text-center text-slate-500"
              >
                No records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(value: unknown, field: DataModelField, locale: string) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-slate-300">—</span>;
  }
  if (field.type === "select") {
    const opt = field.options?.find((o) => o.value === value);
    if (!opt) return String(value);
    const label = opt.i18n_labels?.[locale] || opt.label || opt.value;
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: opt.color ? `${opt.color}1a` : "#e2e8f0",
          color: opt.color || "#334155",
          border: opt.color ? `1px solid ${opt.color}55` : "1px solid transparent",
        }}
      >
        {label}
      </span>
    );
  }
  if (field.type === "checkbox") {
    return value ? "✓" : "✗";
  }
  if (field.type === "date") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  if (field.type === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n.toString() : String(value);
  }
  const s = String(value);
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}
