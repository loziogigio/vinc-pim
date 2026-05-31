"use client";

import { useEffect, useRef, useState } from "react";

export interface AsyncOption { id: string; label: string; }
export interface AsyncPage { items: AsyncOption[]; hasMore: boolean; }

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Fetch a page of options for a search query (debounced by this component). */
  fetchPage: (query: string, page: number) => Promise<AsyncPage>;
  /** Resolve labels for already-selected ids (so chips show names, not ids). */
  resolveLabels?: (ids: string[]) => Promise<Record<string, string>>;
  placeholder?: string;
  debounceMs?: number;
}

export function AsyncMultiSelect({ value, onChange, fetchPage, resolveLabels, placeholder, debounceMs = 250 }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AsyncOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await fetchPage(query, 1);
        setOptions(page.items);
        setOpen(true);
        setLabels((prev) => { const next = { ...prev }; for (const o of page.items) next[o.id] = o.label; return next; });
      } finally { setLoading(false); }
    }, debounceMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, fetchPage, debounceMs]);

  useEffect(() => {
    const missing = value.filter((id) => !labels[id]);
    if (missing.length === 0 || !resolveLabels) return;
    resolveLabels(missing).then((map) => setLabels((prev) => ({ ...prev, ...map })));
  }, [value, labels, resolveLabels]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map((id) => (
          <span key={id} data-testid={`ams-chip-${id}`} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm">
            {labels[id] ?? id}
            <button type="button" data-testid={`ams-remove-${id}`} onClick={() => toggle(id)} className="text-muted-foreground hover:text-foreground" aria-label="Remove">×</button>
          </span>
        ))}
      </div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => options.length && setOpen(true)} placeholder={placeholder} className="w-full rounded border px-2 py-1 text-sm" />
      {open && (loading || options.length > 0) && (
        <ul className="max-h-48 overflow-auto rounded border bg-background text-sm shadow">
          {loading && <li className="px-2 py-1 text-muted-foreground">Loading…</li>}
          {!loading && options.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => toggle(o.id)} className={`block w-full px-2 py-1 text-left hover:bg-muted ${value.includes(o.id) ? "font-semibold" : ""}`}>{o.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
