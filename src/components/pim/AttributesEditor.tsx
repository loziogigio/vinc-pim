"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";

type Attribute = {
  key: string;
  value: string;
  uom?: string;
};

type Props = {
  value: Record<string, any>;
  onChange: (attributes: Record<string, any>) => void;
  disabled?: boolean;
};

export function AttributesEditor({ value, onChange, disabled }: Props) {
  // Convert object to array for easier editing
  const [attributesArray, setAttributesArray] = useState<Attribute[]>(() =>
    Object.entries(value || {}).map(([key, val]) => {
      // Handle both simple values and objects with value/uom
      if (typeof val === 'object' && val !== null && 'value' in val) {
        return {
          key,
          value: String(val.value),
          uom: val.uom || undefined,
        };
      }
      return {
        key,
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
      Object.entries(value || {}).map(([key, val]) => {
        // Handle both simple values and objects with value/uom
        if (typeof val === 'object' && val !== null && 'value' in val) {
          return {
            key,
            value: String(val.value),
            uom: val.uom || undefined,
          };
        }
        return {
          key,
          value: String(val),
          uom: undefined,
        };
      })
    );
  }, [value]);

  function handleAdd() {
    const newAttributes = [...attributesArray, { key: "", value: "", uom: undefined }];
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleRemove(index: number) {
    const newAttributes = attributesArray.filter((_, i) => i !== index);
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleKeyChange(index: number, newKey: string) {
    const newAttributes = [...attributesArray];
    newAttributes[index].key = newKey;
    setAttributesArray(newAttributes);
    updateAttributes(newAttributes);
  }

  function handleValueChange(index: number, newValue: string) {
    const newAttributes = [...attributesArray];
    newAttributes[index].value = newValue;
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
    // Convert array back to object, filtering out empty keys
    const obj: Record<string, any> = {};
    attrs.forEach((attr) => {
      if (attr.key.trim()) {
        // Try to parse as number if possible
        const numValue = Number(attr.value);
        const parsedValue = isNaN(numValue) ? attr.value : numValue;

        // If UOM is provided, store as object with value and uom
        if (attr.uom && attr.uom.trim()) {
          obj[attr.key.trim()] = {
            value: parsedValue,
            uom: attr.uom.trim(),
          };
        } else {
          // Store as simple value
          obj[attr.key.trim()] = parsedValue;
        }
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
              {/* Key Input */}
              <input
                type="text"
                value={attr.key}
                onChange={(e) => handleKeyChange(index, e.target.value)}
                placeholder="Attribute name (e.g., color)"
                disabled={disabled}
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
              />

              {/* Value Input */}
              <input
                type="text"
                value={attr.value}
                onChange={(e) => handleValueChange(index, e.target.value)}
                placeholder="Value (e.g., blue)"
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
          Tip: Numeric values will be automatically detected (e.g., "16" becomes a number). Unit (UOM) is optional.
        </p>
      )}
    </div>
  );
}
