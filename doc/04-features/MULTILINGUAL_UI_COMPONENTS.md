# Multilingual UI Components Guide

Complete guide for using the multilingual UI components in the PIM system.

## Table of Contents

1. [Overview](#overview)
2. [Language Store](#language-store)
3. [Components](#components)
4. [Usage Examples](#usage-examples)
5. [Integration Guide](#integration-guide)

---

## Overview

The PIM system supports dynamic multilingual content across all products. Languages are managed through the database and can be enabled/disabled without restarting the application.

### Supported Features

- ✅ Dynamic language loading from API
- ✅ Language-specific input fields with tabs
- ✅ Translation completeness indicators
- ✅ Language status badges in product lists
- ✅ Fallback logic for missing translations
- ✅ Persistent language selection across sessions

---

## Language Store

### `useLanguageStore`

Global Zustand store for managing language state.

**Location:** `src/lib/stores/languageStore.ts`

#### Store State

```typescript
interface LanguageStore {
  currentLanguage: string;           // Currently selected language for editing
  languages: Language[];             // All languages from database
  isLoading: boolean;                // Loading state

  // Actions
  setCurrentLanguage: (code: string) => void;
  fetchLanguages: () => Promise<void>;
  getEnabledLanguages: () => Language[];
  getLanguageByCode: (code: string) => Language | undefined;
  isLanguageEnabled: (code: string) => boolean;
}
```

#### Usage

```typescript
import { useLanguageStore } from "@/lib/stores/languageStore";

function MyComponent() {
  const {
    currentLanguage,
    languages,
    setCurrentLanguage,
    fetchLanguages,
    getEnabledLanguages
  } = useLanguageStore();

  // Fetch languages on mount
  useEffect(() => {
    fetchLanguages();
  }, []);

  // Get only enabled languages
  const enabled = getEnabledLanguages();

  return (
    <div>
      Current Language: {currentLanguage}
    </div>
  );
}
```

---

## Components

### 1. LanguageSwitcher

Allows users to switch between enabled languages.

**Location:** `src/components/pim/LanguageSwitcher.tsx`

#### Props

```typescript
interface LanguageSwitcherProps {
  variant?: "tabs" | "dropdown" | "compact";
  className?: string;
  showLabel?: boolean;
}
```

#### Variants

- **tabs** - Horizontal tab layout (default) - best for forms
- **dropdown** - Select dropdown - compact for small spaces
- **compact** - Small flag/code buttons - best for toolbars

#### Usage

```tsx
import { LanguageSwitcher } from "@/components/pim/LanguageSwitcher";

// Tabs variant (default)
<LanguageSwitcher variant="tabs" />

// Dropdown variant
<LanguageSwitcher variant="dropdown" />

// Compact variant
<LanguageSwitcher variant="compact" showLabel={false} />
```

---

### 2. MultilingualInput

Text input field that supports multiple languages with tabs.

**Location:** `src/components/pim/MultilingualInput.tsx`

#### Props

```typescript
interface MultilingualInputProps {
  label: string;
  value: MultilingualText;           // Record<string, string>
  onChange: (value: MultilingualText) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
}
```

#### Features

- ✅ Tab interface for each language
- ✅ Visual indicators for completed/missing translations
- ✅ Translation status summary
- ✅ Required field validation per language

#### Usage

```tsx
import { MultilingualInput } from "@/components/pim/MultilingualInput";

const [name, setName] = useState<Record<string, string>>({
  it: "Trapano Elettrico",
  de: "Elektrischer Bohrer",
  en: "Electric Drill",
  cs: ""
});

<MultilingualInput
  label="Product Name"
  value={name}
  onChange={setName}
  placeholder="Enter product name"
  required
  helpText="The main display name for the product"
/>
```

---

### 3. MultilingualTextarea

Textarea field that supports multiple languages with tabs.

**Location:** `src/components/pim/MultilingualTextarea.tsx`

#### Props

```typescript
interface MultilingualTextareaProps {
  label: string;
  value: MultilingualText;
  onChange: (value: MultilingualText) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
  rows?: number;                      // Number of rows (default: 4)
  maxLength?: number;                 // Maximum character count
  showCharCount?: boolean;            // Show character counter (default: true)
}
```

#### Features

- ✅ Tab interface for each language
- ✅ Character count with warnings
- ✅ Resizable textarea
- ✅ Translation status indicators

#### Usage

```tsx
import { MultilingualTextarea } from "@/components/pim/MultilingualTextarea";

const [description, setDescription] = useState<Record<string, string>>({
  it: "Trapano elettrico professionale...",
  de: "Professioneller elektrischer Bohrer...",
  en: "Professional electric drill...",
  cs: ""
});

<MultilingualTextarea
  label="Product Description"
  value={description}
  onChange={setDescription}
  rows={6}
  maxLength={500}
  required
  helpText="Detailed product description for customers"
/>
```

---

### 4. LanguageCompletenessIndicator

Shows translation completeness for each language with visual progress.

**Location:** `src/components/pim/LanguageCompletenessIndicator.tsx`

#### Props

```typescript
interface LanguageCompletenessIndicatorProps {
  product: ProductData;
  variant?: "compact" | "detailed" | "card";
  className?: string;
  threshold?: number;  // Minimum % for "complete" status (default: 80)
}
```

#### Variants

- **compact** - Simple badges showing language codes
- **detailed** - Progress bars with expandable field checklist
- **card** - Standalone card with language grid

#### Usage

```tsx
import { LanguageCompletenessIndicator } from "@/components/pim/LanguageCompletenessIndicator";

// Compact variant for product header
<LanguageCompletenessIndicator
  product={product}
  variant="compact"
/>

// Detailed variant for edit forms
<LanguageCompletenessIndicator
  product={product}
  variant="detailed"
  threshold={80}
/>

// Card variant for dashboards
<LanguageCompletenessIndicator
  product={product}
  variant="card"
/>
```

---

### 5. LanguageStatusBadge

Compact badge showing available/missing translations for a product.

**Location:** `src/components/pim/LanguageStatusBadge.tsx`

#### Props

```typescript
interface LanguageStatusBadgeProps {
  name?: MultilingualText;
  description?: MultilingualText;
  availableLanguages?: string[];     // Array of language codes
  variant?: "minimal" | "detailed" | "flags";
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}
```

#### Variants

- **minimal** - Just a count (e.g., "3/4")
- **detailed** - Language codes with checkmarks
- **flags** - Language flags with status icons

#### Usage

```tsx
import { LanguageStatusBadge } from "@/components/pim/LanguageStatusBadge";

// Minimal - for dense tables
<LanguageStatusBadge
  availableLanguages={["it", "de", "en"]}
  variant="minimal"
  size="sm"
/>

// Flags - for product lists
<LanguageStatusBadge
  name={product.name}
  description={product.description}
  variant="flags"
  size="md"
/>

// Detailed - for product cards
<LanguageStatusBadge
  name={product.name}
  description={product.description}
  variant="detailed"
  showLabel
/>
```

---

## Usage Examples

### Complete Product Edit Form

```tsx
"use client";

import { useState, useEffect } from "react";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { LanguageSwitcher } from "@/components/pim/LanguageSwitcher";
import { MultilingualInput } from "@/components/pim/MultilingualInput";
import { MultilingualTextarea } from "@/components/pim/MultilingualTextarea";
import { LanguageCompletenessIndicator } from "@/components/pim/LanguageCompletenessIndicator";

export default function ProductEditForm({ productId }: { productId: string }) {
  const { fetchLanguages } = useLanguageStore();

  const [product, setProduct] = useState({
    name: { it: "", de: "", en: "", cs: "" },
    slug: { it: "", de: "", en: "", cs: "" },
    description: { it: "", de: "", en: "", cs: "" },
    short_description: { it: "", de: "", en: "", cs: "" },
  });

  // Fetch languages on mount
  useEffect(() => {
    fetchLanguages();
  }, []);

  const handleSave = async () => {
    // Save product with multilingual data
    await fetch(`/api/b2b/pim/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
  };

  return (
    <div className="space-y-6">
      {/* Language Switcher (optional - for preview mode) */}
      <LanguageSwitcher variant="compact" />

      {/* Translation Completeness */}
      <LanguageCompletenessIndicator
        product={product}
        variant="detailed"
      />

      {/* Product Name */}
      <MultilingualInput
        label="Product Name"
        value={product.name}
        onChange={(name) => setProduct({ ...product, name })}
        required
        helpText="The main display name shown to customers"
      />

      {/* URL Slug */}
      <MultilingualInput
        label="URL Slug"
        value={product.slug}
        onChange={(slug) => setProduct({ ...product, slug })}
        required
        helpText="URL-friendly identifier (e.g., electric-drill)"
      />

      {/* Short Description */}
      <MultilingualTextarea
        label="Short Description"
        value={product.short_description}
        onChange={(short_description) =>
          setProduct({ ...product, short_description })
        }
        rows={3}
        maxLength={200}
        helpText="Brief product summary (max 200 characters)"
      />

      {/* Full Description */}
      <MultilingualTextarea
        label="Full Description"
        value={product.description}
        onChange={(description) => setProduct({ ...product, description })}
        rows={8}
        maxLength={2000}
        helpText="Complete product description with all details"
      />

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Save Product
      </button>
    </div>
  );
}
```

### Product List with Language Status

```tsx
import { LanguageStatusBadge } from "@/components/pim/LanguageStatusBadge";

function ProductList({ products }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Languages</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td>{product.name.it || product.name.en}</td>
            <td>
              <LanguageStatusBadge
                name={product.name}
                description={product.description}
                variant="flags"
                size="sm"
              />
            </td>
            <td>{product.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Integration Guide

### Step 1: Initialize Language Store

In your main layout or app component:

```tsx
"use client";

import { useEffect } from "react";
import { useLanguageStore } from "@/lib/stores/languageStore";

export default function PIMLayout({ children }) {
  const { fetchLanguages } = useLanguageStore();

  useEffect(() => {
    // Fetch languages once on app load
    fetchLanguages();
  }, []);

  return <div>{children}</div>;
}
```

### Step 2: Add Language Switcher to Toolbar

```tsx
import { LanguageSwitcher } from "@/components/pim/LanguageSwitcher";

function Toolbar() {
  return (
    <div className="flex items-center justify-between">
      <h1>Product Editor</h1>
      <LanguageSwitcher variant="compact" />
    </div>
  );
}
```

### Step 3: Replace Text Inputs with Multilingual Components

**Before:**
```tsx
<input
  type="text"
  value={product.name}
  onChange={(e) => setProduct({ ...product, name: e.target.value })}
/>
```

**After:**
```tsx
<MultilingualInput
  label="Product Name"
  value={product.name}
  onChange={(name) => setProduct({ ...product, name })}
  required
/>
```

### Step 4: Add Language Status to Product Lists

```tsx
// Add to product list table
<td>
  <LanguageStatusBadge
    availableLanguages={product._available_languages}
    variant="flags"
    size="sm"
  />
</td>
```

### Step 5: Add Completeness Indicator to Edit Pages

```tsx
// Add to product edit page
<LanguageCompletenessIndicator
  product={product}
  variant="detailed"
  threshold={80}
/>
```

---

## API Integration

### Expected API Response Format

When fetching products, the API should return multilingual fields as objects:

```json
{
  "entity_code": "PROD-001",
  "sku": "DRILL-750",
  "name": {
    "it": "Trapano Elettrico Bosch 750W",
    "de": "Bosch Elektrischer Bohrer 750W",
    "en": "Bosch Electric Drill 750W",
    "cs": "Bosch Elektrická vrtačka 750W"
  },
  "description": {
    "it": "Trapano professionale...",
    "de": "Professioneller Bohrer...",
    "en": "Professional drill...",
    "cs": "Profesionální vrtačka..."
  },
  "_available_languages": ["it", "de", "en", "cs"],
  "_language_completeness": {
    "it": 100,
    "de": 90,
    "en": 85,
    "cs": 60
  }
}
```

### Saving Multilingual Data

When saving, send the complete multilingual object:

```typescript
const saveProduct = async (product) => {
  await fetch(`/api/b2b/pim/products/${product.entity_code}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: product.name,              // { it: "...", de: "...", ... }
      description: product.description, // { it: "...", de: "...", ... }
      slug: product.slug,
      // ... other multilingual fields
    }),
  });
};
```

---

## Best Practices

### 1. Always Fetch Languages on Mount

```tsx
useEffect(() => {
  const { fetchLanguages } = useLanguageStore.getState();
  fetchLanguages();
}, []);
```

### 2. Provide Fallback Values

```tsx
// Display name with fallback chain
const displayName = typeof product.name === 'string'
  ? product.name
  : product.name?.it || product.name?.en || Object.values(product.name || {})[0] || 'Untitled';
```

### 3. Validate Required Languages

```tsx
const validateProduct = (product) => {
  const requiredLanguages = ['it', 'en']; // Italian and English required
  const errors = [];

  requiredLanguages.forEach((lang) => {
    if (!product.name?.[lang]) {
      errors.push(`Product name is required in ${lang}`);
    }
  });

  return errors;
};
```

### 4. Show Translation Progress

```tsx
// Always show completeness indicator on edit pages
<LanguageCompletenessIndicator product={product} variant="detailed" />
```

### 5. Use Appropriate Variants

- **Forms**: Use `MultilingualInput` and `MultilingualTextarea`
- **Lists**: Use `LanguageStatusBadge` with "flags" variant
- **Dashboards**: Use `LanguageCompletenessIndicator` with "card" variant
- **Toolbars**: Use `LanguageSwitcher` with "compact" variant

---

## Troubleshooting

### Languages Not Loading

**Problem**: Languages array is empty

**Solution**:
```tsx
const { languages, fetchLanguages } = useLanguageStore();

useEffect(() => {
  if (languages.length === 0) {
    fetchLanguages();
  }
}, [languages]);
```

### Translation Tabs Not Showing

**Problem**: Only one tab appears

**Solution**: Make sure languages are fetched and enabled in `/b2b/pim/languages`

### Character Count Not Working

**Problem**: Character count shows 0/500

**Solution**: Make sure you're passing `showCharCount={true}` and `maxLength` to `MultilingualTextarea`

---

## Related Documentation

- [Multilingual Implementation Summary](/doc/pim/MULTILINGUAL-IMPLEMENTATION-SUMMARY.md)
- [MongoDB to Solr Indexing](/doc/pim/mongodb-to-solr-multilingual-indexing.json)
- [Language Management API](/api/admin/languages)

---

**Last Updated:** 2025-11-19
**Version:** 1.0
