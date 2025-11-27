"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLanguageStore } from "@/lib/stores/languageStore";

type Attribute = {
  slug: string;
  label: Record<string, string> | string;  // Multilingual or simple string
  value: Record<string, string> | string;  // Multilingual or simple string
  uom?: string;  // UOM stays language-independent
};

type Props = {
  value: Record<string, any>;
  onChange: (attributes: Record<string, any>) => void;
  disabled?: boolean;
};

export function AttributesEditor({ value, onChange, disabled }: Props) {
  const { currentLanguage } = useLanguageStore();
  const currentLangCode = currentLanguage || 'en';

  // Helper function to extract text for current language
  const getLocalizedText = (text: string | Record<string, string> | boolean | number | undefined | null, fallback: string = ''): string => {
    if (text === null || text === undefined) return fallback;
    // Handle booleans and numbers - convert to string
    if (typeof text === 'boolean' || typeof text === 'number') return String(text);
    if (typeof text === 'string') return text;
    if (typeof text === 'object') {
      return text[currentLangCode] || text.en || Object.values(text)[0] || fallback;
    }
    return fallback;
  };

  // Helper function to update multilingual text
  const setLocalizedText = (
    existingText: string | Record<string, string> | undefined,
    newValue: string
  ): string | Record<string, string> => {
    // If existing text is an object (multilingual), update only the current language
    if (existingText && typeof existingText === 'object') {
      return {
        ...existingText,
        [currentLangCode]: newValue,
      };
    }
    // If we have multiple enabled languages, create multilingual object
    // Otherwise, keep it as a simple string
    return newValue;
  };

  // Convert object to array for easier editing
  const [attributesArray, setAttributesArray] = useState<Attribute[]>(() =>
    Object.entries(value || {}).map(([slug, val]) => {
      // Handle objects with label, value, and uom
      if (typeof val === 'object' && val !== null && 'value' in val) {
        return {
          slug,
          label: val.label || slug,
          value: val.value || '',
          uom: val.uom || undefined,
        };
      }
      // Legacy: Handle simple values (convert to new structure)
      return {
        slug,
        label: slug,
        value: String(val),
        uom: undefined,
      };
    })
  );

  // Track if we're making an internal update to avoid sync loop
  const isInternalUpdate = useRef(false);

  // Sync with external value changes (but not our own updates)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    setAttributesArray(
      Object.entries(value || {}).map(([slug, val]) => {
        // Handle objects with label, value, and uom
        if (typeof val === 'object' && val !== null && 'value' in val) {
          return {
            slug,
            label: val.label || slug,
            value: val.value || '',
            uom: val.uom || undefined,
          };
        }
        // Legacy: Handle simple values (convert to new structure)
        return {
          slug,
          label: slug,
          value: String(val),
          uom: undefined,
        };
      })
    );
  }, [value]);

  function handleAdd() {
    const newAttributes = [...attributesArray, { slug: "", label: "", value: "", uom: undefined }];
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleRemove(index: number) {
    const newAttributes = attributesArray.filter((_, i) => i !== index);
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleSlugChange(index: number, newSlug: string) {
    const newAttributes = [...attributesArray];
    newAttributes[index].slug = newSlug;
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleLabelChange(index: number, newLabel: string) {
    const newAttributes = [...attributesArray];
    newAttributes[index].label = setLocalizedText(newAttributes[index].label, newLabel);
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleValueChange(index: number, newValue: string) {
    const newAttributes = [...attributesArray];
    newAttributes[index].value = setLocalizedText(newAttributes[index].value, newValue);
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleUomChange(index: number, newUom: string) {
    const newAttributes = [...attributesArray];
    newAttributes[index].uom = newUom || undefined;
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function updateAttributes(attrs: Attribute[]) {
    // Convert array back to object, filtering out empty slugs
    // Store using slug as key, with label, value, and uom in the object
    const obj: Record<string, any> = {};
    attrs.forEach((attr) => {
      if (attr.slug.trim()) {
        // For value: try to parse as number if it's a simple string and looks like a number
        let processedValue: any = attr.value;
        if (typeof attr.value === 'string') {
          const numValue = Number(attr.value);
          processedValue = isNaN(numValue) ? attr.value : numValue;
        }

        // Store as object with label, value, and optional uom
        // Label and value can be multilingual objects or simple strings
        obj[attr.slug.trim()] = {
          label: attr.label,
          value: processedValue,
          ...(attr.uom && attr.uom.trim() ? { uom: attr.uom.trim() } : {}),
        };
      }
    });

    // Mark as internal update to prevent sync loop
    isInternalUpdate.current = true;
    onChange(obj);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add custom attributes that don't belong to a specific product type
        </p>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Attribute
        </button>
      </div>

      {/* Attributes List */}
      {attributesArray.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">No custom attributes yet</p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add First Attribute
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {attributesArray.map((attr, index) => (
            <div key={index} className="flex items-center gap-2">
              {/* Slug Input */}
              <input
                type="text"
                value={attr.slug}
                onChange={(e) => handleSlugChange(index, e.target.value)}
                placeholder="Slug (e.g., material)"
                disabled={disabled}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none disabled:opacity-50"
              />

              {/* Label Input */}
              <input
                type="text"
                value={getLocalizedText(attr.label, '')}
                onChange={(e) => handleLabelChange(index, e.target.value)}
                placeholder={`Label (e.g., Material) [${currentLangCode.toUpperCase()}]`}
                disabled={disabled}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
              />

              {/* Value Input */}
              <input
                type="text"
                value={getLocalizedText(attr.value, '')}
                onChange={(e) => handleValueChange(index, e.target.value)}
                placeholder={`Value (e.g., Cotton) [${currentLangCode.toUpperCase()}]`}
                disabled={disabled}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
              />

              {/* UOM Input */}
              <input
                type="text"
                value={attr.uom || ""}
                onChange={(e) => handleUomChange(index, e.target.value)}
                placeholder="Unit (e.g., kg, cm)"
                disabled={disabled}
                className="w-32 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
              />

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="p-2 rounded text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                title="Remove attribute"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper Text */}
      {attributesArray.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tip: <strong>Slug</strong> is language-independent and used for faceting (e.g., "material").
          <strong> Label</strong> and <strong>Value</strong> are multilingual - switch languages to edit different translations.
          Numeric values are auto-detected. Unit (UOM) is optional and language-independent.
        </p>
      )}
    </div>
  );
}
