"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ImportPanelProps {
  slug: string;
  onImported?: () => void;
}

type Result = {
  submitted: number;
  created: number;
  updated: number;
  deleted: number;
  errors: Array<{ index: number; error: string; path?: string }>;
} | null;

export function ImportPanel({ slug, onImported }: ImportPanelProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (e) {
      setError(
        "Invalid JSON: " + (e instanceof Error ? e.message : String(e))
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/b2b/data-models/${encodeURIComponent(slug)}/records/batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
      } else {
        setResult(json.data);
        onImported?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-slate-600">
          Paste a batch payload matching the{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            POST /records/batch
          </code>{" "}
          shape.
        </p>
        <details className="mt-2 text-xs text-slate-500">
          <summary className="cursor-pointer">Show example</summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-50 p-3 font-mono text-[11px]">
{`{
  "merge_mode": "partial",
  "source": "mymb-erp",
  "batch_metadata": {
    "batch_id": "erp-history-2026-05-14",
    "batch_part": 1,
    "batch_total_parts": 1,
    "batch_total_items": 1
  },
  "records": [
    {
      "relation_id": "C-XXXXXXXX",
      "channel": "default",
      "external_ref": "PB2B/2026/82570",
      "data": {
        "document_number": "OB2B/82570",
        "document_date": "2026-05-12",
        "total": 19.85
      }
    }
  ]
}`}
          </pre>
        </details>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder='{"merge_mode":"partial","records":[…]}'
        className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {text ? `${text.length.toLocaleString()} chars` : ""}
        </span>
        <Button onClick={onSubmit} disabled={busy || !text.trim()}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p>
            <strong>Submitted:</strong> {result.submitted} ·{" "}
            <strong>Created:</strong> {result.created} ·{" "}
            <strong>Updated:</strong> {result.updated} ·{" "}
            <strong>Deleted:</strong> {result.deleted}
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Per-record errors:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {result.errors.map((er, i) => (
                  <li key={i}>
                    [#{er.index}] {er.path ? `${er.path}: ` : ""}
                    {er.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
