"use client";

/**
 * Inline endpoint reference for a single data model.
 *
 * Lists the 8 endpoints (5 admin record routes + batch + sync-cursor + /me),
 * each with auth options, a sample JSON body derived from the definition's
 * fields, and a copy-pasteable curl snippet.
 */

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type {
  DataModelField,
  IDataModelDefinition,
} from "@/lib/db/models/data-model-definition";

interface ApiDocsPanelProps {
  definition: Pick<
    IDataModelDefinition,
    "slug" | "relation" | "cardinality" | "channel" | "fields" | "external_ref_field" | "readable_by_end_user"
  >;
  /** Origin used in curl examples. Defaults to current window origin. */
  origin?: string;
}

export function ApiDocsPanel({ definition, origin }: ApiDocsPanelProps) {
  const baseOrigin =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "https://<host>");
  const base = `${baseOrigin}/api/b2b/data-models/${definition.slug}`;
  const meBase = `${baseOrigin}/api/b2b/me/data/${definition.slug}`;

  const sampleData = buildSample(definition.fields);
  const sampleRecord = {
    relation_id: definition.relation === "customer" ? "C-XXXXXXXX" : "PU-XXXXXXXX",
    ...(definition.channel === "*" ? { channel: "default" } : {}),
    ...(definition.external_ref_field
      ? { external_ref: String(sampleData[definition.external_ref_field] ?? "ext-ref-1") }
      : {}),
    data: sampleData,
  };

  const endpoints: Endpoint[] = [
    {
      method: "GET",
      path: base,
      title: "List records",
      sample: null,
      who: ["admin", "api-key"],
    },
    {
      method: "POST",
      path: base + "/records",
      title:
        definition.cardinality === "single"
          ? "Upsert record (1:1 on relation_id+channel)"
          : definition.external_ref_field
          ? `Upsert record (by external_ref \"${definition.external_ref_field}\")`
          : "Create record",
      sample: sampleRecord,
      who: ["admin", "api-key"],
    },
    {
      method: "POST",
      path: base + "/records/batch",
      title: "Batch import",
      sample: {
        merge_mode: "partial",
        source: "mymb-erp",
        records: [sampleRecord],
      },
      who: ["admin", "api-key"],
    },
    {
      method: "GET",
      path: base + "/records/{id}",
      title: "Read one record",
      sample: null,
      who: ["admin", "api-key"],
    },
    {
      method: "PATCH",
      path: base + "/records/{id}",
      title: "Patch record",
      sample: { data: sampleData },
      who: ["admin", "api-key"],
    },
    {
      method: "DELETE",
      path: base + "/records/{id}",
      title: "Delete record",
      sample: null,
      who: ["admin", "api-key"],
    },
    {
      method: "GET",
      path: base + "/sync-cursor?relation_id=…",
      title: "Sync cursor (most recent imported_at + external_ref)",
      sample: null,
      who: ["admin", "api-key"],
    },
    ...(definition.readable_by_end_user
      ? ([
          {
            method: "GET",
            path: meBase + "/records",
            title: "End-user list (storefront session)",
            sample: null,
            who: ["bearer"],
          },
          {
            method: "GET",
            path: meBase + "/records/{id}",
            title: "End-user read one",
            sample: null,
            who: ["bearer"],
          },
        ] as Endpoint[])
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <p>
          Manage API keys in Super Admin → API Keys. Required permissions:{" "}
          <code className="font-mono">*</code> or one of{" "}
          <code className="font-mono">data-models:read</code>,{" "}
          <code className="font-mono">data-models:write</code>.
        </p>
      </div>

      {endpoints.map((ep, i) => (
        <EndpointCard key={i} endpoint={ep} />
      ))}
    </div>
  );
}

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  sample: unknown;
  who: readonly string[];
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [copied, setCopied] = useState(false);

  const curl = buildCurl(endpoint);

  const copy = () => {
    void navigator.clipboard.writeText(curl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${methodColor(
            endpoint.method
          )}`}
        >
          {endpoint.method}
        </span>
        <code className="break-all font-mono text-xs text-slate-800">
          {endpoint.path}
        </code>
        <span className="ml-auto text-xs text-slate-500">{endpoint.title}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase">
        {endpoint.who.includes("admin") && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
            session
          </span>
        )}
        {endpoint.who.includes("api-key") && (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
            api-key
          </span>
        )}
        {endpoint.who.includes("bearer") && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
            bearer (SSO)
          </span>
        )}
      </div>

      {endpoint.sample !== null && endpoint.sample !== undefined && (
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
          {JSON.stringify(endpoint.sample, null, 2)}
        </pre>
      )}

      <div className="mt-2 relative">
        <pre className="overflow-auto rounded bg-slate-900 p-3 pr-12 font-mono text-[11px] leading-snug text-slate-100">
          {curl}
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
          title="Copy curl"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function methodColor(m: string): string {
  if (m === "GET") return "bg-blue-100 text-blue-700";
  if (m === "POST") return "bg-emerald-100 text-emerald-700";
  if (m === "PATCH") return "bg-amber-100 text-amber-700";
  if (m === "DELETE") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function buildCurl(ep: Endpoint): string {
  const lines = [`curl -X ${ep.method} '${ep.path}' \\`];
  if (ep.who.includes("api-key")) {
    lines.push(`  -H 'x-auth-method: api-key' \\`);
    lines.push(`  -H 'x-api-key-id: $API_KEY_ID' \\`);
    lines.push(`  -H 'x-api-secret: $API_SECRET' \\`);
  } else if (ep.who.includes("bearer")) {
    lines.push(`  -H 'Authorization: Bearer $JWT' \\`);
  }
  if (ep.sample !== null && ep.sample !== undefined) {
    lines.push(`  -H 'Content-Type: application/json' \\`);
    lines.push(`  -d '${JSON.stringify(ep.sample)}'`);
  } else {
    // Remove the trailing backslash from the last line
    const last = lines.pop()!;
    lines.push(last.replace(/\s\\$/, ""));
  }
  return lines.join("\n");
}

function buildSample(fields: DataModelField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    out[f.slug] = sampleForField(f);
  }
  return out;
}

function sampleForField(f: DataModelField): unknown {
  switch (f.type) {
    case "text":
    case "textarea":
      return f.slug;
    case "email":
      return "user@example.com";
    case "number":
      return 0;
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "checkbox":
      return false;
    case "select":
      return f.options?.[0]?.value ?? "";
    case "object":
      return buildSample(f.fields ?? []);
    case "array_of_objects":
      return [buildSample(f.fields ?? [])];
  }
}
