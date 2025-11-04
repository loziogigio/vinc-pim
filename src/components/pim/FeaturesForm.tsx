"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Check } from "lucide-react";

type FeatureDefinition = {
  feature_id: string;
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multiselect" | "boolean";
  unit?: string;
  options?: string[];
  required: boolean;
};

type FeatureValue = {
  key: string;
  label: string;
  value: string | number | boolean | string[];
  unit?: string;
};

type Props = {
  features: FeatureDefinition[];
  values: FeatureValue[];
  onChange: (values: FeatureValue[]) => void;
  disabled?: boolean;
};

export function FeaturesForm({ features, values, onChange, disabled }: Props) {
  const [featureValues, setFeatureValues] = useState<Map<string, any>>(new Map());

  // Initialize feature values from props
  useEffect(() => {
    const valueMap = new Map<string, any>();
    values.forEach((v) => {
      valueMap.set(v.key, v.value);
    });
    setFeatureValues(valueMap);
  }, [values]);

  function updateFeatureValue(feature: FeatureDefinition, value: any) {
    const newValues = new Map(featureValues);
    newValues.set(feature.key, value);
    setFeatureValues(newValues);

    // Build updated values array
    const updatedValues: FeatureValue[] = features
      .map((f) => {
        const val = newValues.get(f.key);
        if (val === undefined || val === "" || val === null) return null;

        const featureValue: FeatureValue = {
          key: f.key,
          label: f.label,
          value: val,
        };

        // Only include unit if it's defined
        if (f.unit) {
          featureValue.unit = f.unit;
        }

        return featureValue;
      })
      .filter((v): v is FeatureValue => v !== null);

    onChange(updatedValues);
  }

  if (features.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          Select a product type to add technical features
        </p>
      </div>
    );
  }

  // Group features by required/optional
  const requiredFeatures = features.filter((f) => f.required);
  const optionalFeatures = features.filter((f) => !f.required);

  return (
    <div className="space-y-6">
      {/* Required Features */}
      {requiredFeatures.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Required Features</h3>
            <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
              {requiredFeatures.length} required
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredFeatures.map((feature) => (
              <FeatureInput
                key={feature.feature_id}
                feature={feature}
                value={featureValues.get(feature.key)}
                onChange={(value) => updateFeatureValue(feature, value)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional Features */}
      {optionalFeatures.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Optional Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optionalFeatures.map((feature) => (
              <FeatureInput
                key={feature.feature_id}
                feature={feature}
                value={featureValues.get(feature.key)}
                onChange={(value) => updateFeatureValue(feature, value)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual feature input component
function FeatureInput({
  feature,
  value,
  onChange,
  disabled,
}: {
  feature: FeatureDefinition;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}) {
  const hasValue = value !== undefined && value !== "" && value !== null;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {feature.label}
        {feature.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Different input types based on feature type */}
      {feature.type === "text" && (
        <div className="relative">
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={feature.required}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            placeholder={`Enter ${feature.label.toLowerCase()}${feature.unit ? ` (${feature.unit})` : ""}`}
          />
          {feature.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {feature.unit}
            </span>
          )}
          {hasValue && (
            <Check className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          )}
        </div>
      )}

      {feature.type === "number" && (
        <div className="relative">
          <input
            type="number"
            value={value || ""}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : "")}
            disabled={disabled}
            required={feature.required}
            step="any"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            placeholder={`Enter ${feature.label.toLowerCase()}${feature.unit ? ` (${feature.unit})` : ""}`}
          />
          {feature.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {feature.unit}
            </span>
          )}
          {hasValue && (
            <Check className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          )}
        </div>
      )}

      {feature.type === "select" && (
        <div className="relative">
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={feature.required}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="">Select {feature.label.toLowerCase()}...</option>
            {(feature.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {hasValue && (
            <Check className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          )}
        </div>
      )}

      {feature.type === "multiselect" && (
        <div className="space-y-2">
          <div className="p-3 rounded border border-border bg-background min-h-[100px]">
            {(feature.options || []).map((option) => {
              const selectedValues = Array.isArray(value) ? value : [];
              const isSelected = selectedValues.includes(option);

              return (
                <label key={option} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...selectedValues, option]);
                      } else {
                        onChange(selectedValues.filter((v: string) => v !== option));
                      }
                    }}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">{option}</span>
                </label>
              );
            })}
          </div>
          {hasValue && Array.isArray(value) && value.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" />
              <span>{value.length} selected</span>
            </div>
          )}
        </div>
      )}

      {feature.type === "boolean" && (
        <label className="flex items-center gap-3 p-3 rounded border border-border bg-background hover:border-primary transition cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-foreground">
            {value === true ? "Yes" : "No"}
          </span>
          {value === true && <Check className="ml-auto h-4 w-4 text-green-600" />}
        </label>
      )}

      {/* Feature key hint */}
      <p className="text-xs text-muted-foreground">
        Key: <code className="px-1 py-0.5 rounded bg-muted font-mono">{feature.key}</code>
      </p>
    </div>
  );
}
