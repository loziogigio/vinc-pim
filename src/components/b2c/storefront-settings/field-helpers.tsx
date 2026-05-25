"use client";

export const inputClass =
  "w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground bg-background focus:border-primary focus:outline-none";

export const labelClass = "block text-sm font-medium text-foreground mb-1";

export const helperClass = "mt-1 text-xs text-muted-foreground";

export function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {helper && <p className={helperClass}>{helper}</p>}
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded border border-border p-0.5 bg-background"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#009688"
          className={inputClass}
        />
      </div>
      {helper && <p className={helperClass}>{helper}</p>}
    </div>
  );
}
