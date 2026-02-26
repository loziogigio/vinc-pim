"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface ChannelOption {
  code: string;
  name: string;
  color?: string;
}

interface ChannelSelectProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Label shown above the select. Defaults to "Canale". */
  label?: string;
  /** Show the label element. Defaults to true. */
  showLabel?: boolean;
}

/**
 * Reusable channel selector.
 * Fetches the list of active channels from /api/b2b/channels and renders a <select>.
 * Use in customer create/edit forms and portal user create/edit forms.
 *
 * Example:
 *   <ChannelSelect value={form.channel} onChange={(code) => setForm({ ...form, channel: code })} />
 */
export function ChannelSelect({
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  label = "Canale",
  showLabel = true,
}: ChannelSelectProps) {
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/b2b/channels");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setChannels(data.channels ?? []);
        }
      } catch {
        // Silently fail — the select will just be empty
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectClass = [
    "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent",
    disabled ? "bg-slate-50 text-slate-500" : "bg-white",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {showLabel && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Caricamento canali...
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          className={selectClass}
        >
          {channels.length === 0 && (
            <option value="">Nessun canale disponibile</option>
          )}
          {channels.map((ch) => (
            <option key={ch.code} value={ch.code}>
              {ch.name} ({ch.code})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
