"use client";

import { useState, KeyboardEvent } from "react";
import { X, Plus, Tag } from "lucide-react";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function TagsInput({ value = [], onChange, disabled, placeholder = "Add tags..." }: Props) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      // Remove last tag on backspace if input is empty
      removeTag(value.length - 1);
    }
  }

  function addTag() {
    const trimmedValue = inputValue.trim().replace(/,/g, "");
    if (!trimmedValue) return;

    // Check if tag already exists (case-insensitive)
    const exists = value.some(tag => tag.toLowerCase() === trimmedValue.toLowerCase());
    if (exists) {
      setInputValue("");
      return;
    }

    onChange([...value, trimmedValue]);
    setInputValue("");
  }

  function removeTag(index: number) {
    const newTags = value.filter((_, i) => i !== index);
    onChange(newTags);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground">
        Tags
      </label>

      {/* Tags Display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
            >
              <Tag className="h-3 w-3" />
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  className="p-0.5 rounded-full hover:bg-primary/20 transition"
                  title="Remove tag"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={addTag}
          disabled={disabled || !inputValue.trim()}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add a tag. Press Backspace to remove the last tag.
      </p>
    </div>
  );
}
