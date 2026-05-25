"use client";

/**
 * Small shared form helpers for the global B2B settings section components.
 * Lifted from the legacy /b2b/home-settings page so the extracted section
 * components keep the exact same look & behaviour.
 */

export const ColorInput = ({
  id,
  label,
  value,
  onChange,
  helper,
  allowClear,
  onClear,
  clearLabel,
}: {
  id: string;
  label: string;
  value?: string;
  helper?: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
  onClear?: () => void;
  clearLabel?: string;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </label>
      {allowClear && value && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {clearLabel || "Clear"}
        </button>
      )}
    </div>
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="color"
        value={value || "#ffffff"}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-12 cursor-pointer rounded-md border border-border bg-background"
      />
      <input
        type="text"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="#FFFFFF"
        className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
    {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
  </div>
);
