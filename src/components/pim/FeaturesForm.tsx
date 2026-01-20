"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Check, ChevronDown } from "lucide-react";

type FeatureDefinition = {
  technical_specification_id?: string;
  feature_id?: string; // Legacy support
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
  const [emptyExpanded, setEmptyExpanded] = useState(false);

  // Initialize feature values from props
  useEffect(() => {
    const valueMap = new Map<string, any>();
    values.forEach((v) => {
      valueMap.set(v.key, v.value);
    });
    setFeatureValues(valueMap);
  }, [values]);

  function hasFeatureValue(key: string): boolean {
    const val = featureValues.get(key);
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }

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

    console.log("🔧 FeaturesForm onChange:", {
      feature_key: feature.key,
      new_value: value,
      total_values: updatedValues.length,
      updatedValues,
    });
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

  // Group features: WITH values first, WITHOUT values in accordion
  const featuresWithValues = features.filter((f) => hasFeatureValue(f.key));
  const featuresWithoutValues = features.filter((f) => !hasFeatureValue(f.key));

  return (
    <div className="space-y-6">
      {/* Features WITH values */}
      {featuresWithValues.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Filled Features</h3>
            <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">
              {featuresWithValues.length} filled
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuresWithValues.map((feature) => (
              <FeatureInput
                key={feature.technical_specification_id || feature.feature_id || feature.key}
                feature={feature}
                value={featureValues.get(feature.key)}
                onChange={(value) => updateFeatureValue(feature, value)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Features WITHOUT values - in expandable accordion */}
      {featuresWithoutValues.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setEmptyExpanded(!emptyExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Empty Features</h3>
              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                {featuresWithoutValues.length} empty
              </span>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-muted-foreground transition-transform ${
                emptyExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
          {emptyExpanded && (
            <div className="p-4 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuresWithoutValues.map((feature) => (
                  <FeatureInput
                    key={feature.technical_specification_id || feature.feature_id || feature.key}
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
  // Default to "text" if type is not specified
  const featureType = feature.type || "text";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {feature.label}
        {feature.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Different input types based on feature type */}
      {featureType === "text" && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              required={feature.required}
              className={`w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ${hasValue ? "pr-8" : ""}`}
              placeholder={`Enter ${feature.label.toLowerCase()}`}
            />
            {hasValue && (
              <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
            )}
          </div>
          {feature.unit && (
            <div className="flex items-center px-3 rounded border border-border bg-muted/50 text-sm font-medium text-muted-foreground min-w-[50px] justify-center">
              {feature.unit}
            </div>
          )}
        </div>
      )}

      {featureType === "number" && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={value || ""}
              onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : "")}
              disabled={disabled}
              required={feature.required}
              step="any"
              className={`w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ${hasValue ? "pr-8" : ""}`}
              placeholder={`Enter ${feature.label.toLowerCase()}`}
            />
            {hasValue && (
              <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
            )}
          </div>
          {feature.unit && (
            <div className="flex items-center px-3 rounded border border-border bg-muted/50 text-sm font-medium text-muted-foreground min-w-[50px] justify-center">
              {feature.unit}
            </div>
          )}
        </div>
      )}

      {featureType === "select" && (
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

      {featureType === "multiselect" && (
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

      {featureType === "boolean" && (
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
