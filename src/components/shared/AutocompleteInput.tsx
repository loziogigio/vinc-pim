"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  label?: string;
  className?: string;
  inputClassName?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  onSearch,
  suggestions,
  placeholder,
  label,
  className,
  inputClassName,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes(value.toLowerCase())
  );

  const showDropdown = open && focused && filtered.length > 0;

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onSearch?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          className={
            inputClassName ||
            "w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          }
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showDropdown && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition truncate"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
