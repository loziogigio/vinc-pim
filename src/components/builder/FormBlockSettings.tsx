"use client";

import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nanoid } from "nanoid";
import type { FormBlockConfig, FormFieldConfig, FormFieldType } from "@/lib/types/blocks";

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
];

interface FormBlockSettingsProps {
  config: FormBlockConfig;
  onChange: (config: FormBlockConfig) => void;
}

export const FormBlockSettings = ({ config, onChange }: FormBlockSettingsProps) => {
  const [fields, setFields] = useState<FormFieldConfig[]>(config.fields || []);

  const updateConfig = (partial: Partial<FormBlockConfig>) => {
    onChange({ ...config, ...partial });
  };

  const updateFields = (newFields: FormFieldConfig[]) => {
    setFields(newFields);
    onChange({ ...config, fields: newFields });
  };

  const addField = () => {
    const newField: FormFieldConfig = {
      id: nanoid(8),
      type: "text",
      label: "",
      placeholder: "",
      required: false,
    };
    updateFields([...fields, newField]);
  };

  const removeField = (fieldId: string) => {
    updateFields(fields.filter((f) => f.id !== fieldId));
  };

  const updateField = (fieldId: string, updates: Partial<FormFieldConfig>) => {
    updateFields(
      fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f))
    );
  };

  const addOption = (fieldId: string) => {
    updateFields(
      fields.map((f) =>
        f.id === fieldId
          ? { ...f, options: [...(f.options || []), { label: "", value: "" }] }
          : f
      )
    );
  };

  const removeOption = (fieldId: string, optIndex: number) => {
    updateFields(
      fields.map((f) =>
        f.id === fieldId
          ? { ...f, options: (f.options || []).filter((_, i) => i !== optIndex) }
          : f
      )
    );
  };

  const updateOption = (
    fieldId: string,
    optIndex: number,
    updates: { label?: string; value?: string }
  ) => {
    updateFields(
      fields.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              options: (f.options || []).map((opt, i) =>
                i === optIndex ? { ...opt, ...updates } : opt
              ),
            }
          : f
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Form Title */}
      <div>
        <label className="text-sm font-medium text-slate-700">Form Title</label>
        <Input
          value={config.title || ""}
          onChange={(e) => updateConfig({ title: e.target.value })}
          placeholder="Contact Us"
          className="mt-2"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium text-slate-700">Description</label>
        <textarea
          value={config.description || ""}
          onChange={(e) => updateConfig({ description: e.target.value })}
          rows={2}
          placeholder="Fill out the form below..."
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Fields */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            Form Fields ({fields.length})
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Field
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start gap-2">
                <GripVertical className="mt-2 h-4 w-4 flex-shrink-0 text-slate-400" />
                <div className="flex-1 space-y-3">
                  {/* Row 1: Label + Type + Required */}
                  <div className="grid grid-cols-[1fr_120px_80px] gap-2">
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.id, { label: e.target.value })
                      }
                      placeholder="Field label"
                    />
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(field.id, {
                          type: e.target.value as FormFieldType,
                        })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>
                          {ft.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={(e) =>
                          updateField(field.id, { required: e.target.checked })
                        }
                        className="rounded"
                      />
                      Req.
                    </label>
                  </div>

                  {/* Row 2: Placeholder (not for checkbox) */}
                  {field.type !== "checkbox" && (
                    <Input
                      value={field.placeholder || ""}
                      onChange={(e) =>
                        updateField(field.id, { placeholder: e.target.value })
                      }
                      placeholder="Placeholder text"
                      className="text-sm"
                    />
                  )}

                  {/* Row 3: Options for select */}
                  {field.type === "select" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Options
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addOption(field.id)}
                          className="h-6 px-2 text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add
                        </Button>
                      </div>
                      {(field.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex gap-2">
                          <Input
                            value={opt.label}
                            onChange={(e) =>
                              updateOption(field.id, optIdx, {
                                label: e.target.value,
                                value:
                                  opt.value ||
                                  e.target.value
                                    .toLowerCase()
                                    .replace(/\s+/g, "-"),
                              })
                            }
                            placeholder="Label"
                            className="text-sm"
                          />
                          <Input
                            value={opt.value}
                            onChange={(e) =>
                              updateOption(field.id, optIdx, {
                                value: e.target.value,
                              })
                            }
                            placeholder="Value"
                            className="w-32 text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(field.id, optIdx)}
                            className="h-9 w-9 p-0 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete field button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeField(field.id)}
                  className="mt-0.5 h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No fields yet. Click &quot;Add Field&quot; to start building your form.
            </div>
          )}
        </div>
      </div>

      {/* Submit Button Text */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Submit Button Text
        </label>
        <Input
          value={config.submit_button_text || ""}
          onChange={(e) => updateConfig({ submit_button_text: e.target.value })}
          placeholder="Send Message"
          className="mt-2"
        />
      </div>

      {/* Success Message */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Success Message
        </label>
        <Input
          value={config.success_message || ""}
          onChange={(e) => updateConfig({ success_message: e.target.value })}
          placeholder="Thank you! We'll get back to you soon."
          className="mt-2"
        />
      </div>

      {/* Notification Email */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Notification Email
        </label>
        <Input
          type="email"
          value={config.notification_email || ""}
          onChange={(e) => updateConfig({ notification_email: e.target.value })}
          placeholder="admin@example.com"
          className="mt-2"
        />
        <p className="mt-1 text-xs text-slate-500">
          Submissions will be emailed to this address.
        </p>
      </div>
    </div>
  );
};
