# Language System Comparison: Hardcoded vs Dynamic

Quick comparison showing the advantages of the dynamic language system.

---

## 🔴 Before: Hardcoded Languages

### Adding French Required Changes in Multiple Files:

#### 1. TypeScript Type (pim-product.ts)
```typescript
// ❌ Had to manually update
export type SupportedLanguage = "it" | "de" | "en" | "cs" | "fr";
```

#### 2. Mongoose Schema (pim-product.ts)
```typescript
// ❌ Had to manually add to every schema helper
const MultilingualTextSchema = {
  it: { type: String },
  de: { type: String },
  en: { type: String },
  cs: { type: String },
  fr: { type: String },  // ❌ Manual addition
};

// ❌ Had to update features
features: {
  it: [{ type: String }],
  de: [{ type: String }],
  en: [{ type: String }],
  cs: [{ type: String }],
  fr: [{ type: String }],  // ❌ Manual addition
},

// ❌ Had to update specifications (45 lines of repetitive code)
specifications: {
  it: [{ ... }],
  de: [{ ... }],
  en: [{ ... }],
  cs: [{ ... }],
  fr: [{ ... }],  // ❌ Manual addition
},

// ❌ Had to update attributes (30 lines of repetitive code)
attributes: {
  it: [{ ... }],
  de: [{ ... }],
  en: [{ ... }],
  cs: [{ ... }],
  fr: [{ ... }],  // ❌ Manual addition
},

// ❌ Had to update enums
media: [{
  language: { type: String, enum: ["it", "de", "en", "cs", "fr"] }  // ❌ Manual
}],

promotions: [{
  language: { type: String, enum: ["it", "de", "en", "cs", "fr"] }  // ❌ Manual
}]
```

**Total: ~150 lines of code changes across 1 file**

---

## 🟢 After: Dynamic Languages

### Adding French Requires Changes in ONE File:

#### 1. Language Configuration (languages.ts)
```typescript
// ✅ Single file update
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  // ... existing languages ...

  // ✅ Just add this entry
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    isDefault: false,
    isEnabled: true,
    solrAnalyzer: "text_fr",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    numberFormat: "fr-FR"
  },
];
```

#### 2. Everything Else Updates Automatically
```typescript
// ✅ Type automatically includes "fr"
export type MultilingualText = Record<string, string>;

// ✅ Schema automatically includes "fr"
const MultilingualTextSchema = createMultilingualTextSchema(); // Uses getLanguageCodes()

// ✅ Features automatically includes "fr"
const FeaturesSchema = createFeaturesSchema(); // Uses getLanguageCodes()

// ✅ Specifications automatically includes "fr"
const SpecificationsSchema = createSpecificationsSchema(); // Uses getLanguageCodes()

// ✅ Attributes automatically includes "fr"
const AttributesSchema = createAttributesSchema(); // Uses getLanguageCodes()

// ✅ Enums automatically include "fr"
language: { type: String, enum: getLanguageCodes() }  // Dynamic!
```

**Total: ~15 lines of code changes in 1 file**

---

## 📊 Comparison Table

| Task | Hardcoded | Dynamic |
|------|-----------|---------|
| **Add new language** | Edit 10+ places in 1 file | Add 1 entry in config |
| **Lines changed** | ~150 lines | ~15 lines |
| **Files modified** | 1 file | 1 file |
| **Risk of errors** | High (easy to miss a place) | Low (one source of truth) |
| **Schema updates** | Manual (each field type) | Automatic (generated) |
| **Enum updates** | Manual (each enum) | Automatic (dynamic) |
| **Type safety** | Compile-time | Runtime + config validation |
| **Code duplication** | High (repetitive) | Low (DRY principle) |
| **Disable language** | Delete code | Set isEnabled: false |
| **Re-enable language** | Re-add code | Set isEnabled: true |

---

## 🎯 Real-World Example

### Scenario: Add 5 New Languages (FR, ES, PT, NL, PL)

#### Hardcoded Approach
```typescript
// ❌ Update type
export type SupportedLanguage = "it" | "de" | "en" | "cs" | "fr" | "es" | "pt" | "nl" | "pl";

// ❌ Update MultilingualTextSchema (9 languages × 1 line = 9 lines)
const MultilingualTextSchema = {
  it: { type: String },
  de: { type: String },
  en: { type: String },
  cs: { type: String },
  fr: { type: String },
  es: { type: String },
  pt: { type: String },
  nl: { type: String },
  pl: { type: String },
};

// ❌ Update features (9 languages × 1 line = 9 lines)
features: {
  it: [{ type: String }],
  de: [{ type: String }],
  en: [{ type: String }],
  cs: [{ type: String }],
  fr: [{ type: String }],
  es: [{ type: String }],
  pt: [{ type: String }],
  nl: [{ type: String }],
  pl: [{ type: String }],
},

// ❌ Update specifications (9 languages × 9 lines = 81 lines)
specifications: {
  it: [{ key: { type: String, required: true }, ... }],
  de: [{ key: { type: String, required: true }, ... }],
  en: [{ key: { type: String, required: true }, ... }],
  cs: [{ key: { type: String, required: true }, ... }],
  fr: [{ key: { type: String, required: true }, ... }],
  es: [{ key: { type: String, required: true }, ... }],
  pt: [{ key: { type: String, required: true }, ... }],
  nl: [{ key: { type: String, required: true }, ... }],
  pl: [{ key: { type: String, required: true }, ... }],
},

// ❌ Update attributes (9 languages × 7 lines = 63 lines)
// ❌ Update media enum
// ❌ Update promotions enum

// Total: ~300+ lines of repetitive code
```

#### Dynamic Approach
```typescript
// ✅ Just add 5 entries to config
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  // ... existing 4 languages ...

  { code: "fr", name: "French", nativeName: "Français", ... },
  { code: "es", name: "Spanish", nativeName: "Español", ... },
  { code: "pt", name: "Portuguese", nativeName: "Português", ... },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", ... },
  { code: "pl", name: "Polish", nativeName: "Polski", ... },
];

// ✅ Everything else updates automatically!
// Total: ~75 lines (5 languages × 15 lines each)
```

**Time savings: 300+ lines → 75 lines (75% reduction)**

---

## 🚀 Migration Path

If you have existing hardcoded implementation:

### Step 1: Create Language Config
```bash
# Create the config file
touch vinc-pim/src/config/languages.ts
# Add all current languages to config
```

### Step 2: Update Model Imports
```typescript
// Add import
import { getLanguageCodes, isValidLanguageCode } from "../../config/languages";
```

### Step 3: Replace Type Definition
```typescript
// Change from:
export type SupportedLanguage = "it" | "de" | "en" | "cs";

// To:
export type SupportedLanguage = string;
export type MultilingualText = Record<string, string>;
```

### Step 4: Replace Schema Helpers
```typescript
// Replace hardcoded schemas with generators
const MultilingualTextSchema = createMultilingualTextSchema();
const FeaturesSchema = createFeaturesSchema();
const SpecificationsSchema = createSpecificationsSchema();
const AttributesSchema = createAttributesSchema();
```

### Step 5: Test
```bash
# Restart application
npm run dev

# Verify schema includes all languages
# Test CRUD operations
# Verify existing data still works
```

---

## ✅ Benefits Summary

### Development Experience
- 🎯 **Single source of truth** - one config file
- 🔄 **DRY principle** - no repetitive code
- 🛡️ **Lower error risk** - can't forget to update a field
- 📝 **Easier code reviews** - changes are obvious
- 🚀 **Faster development** - add languages in minutes

### Production Benefits
- 🔧 **Easy maintenance** - clear what languages are supported
- 🌍 **Flexible scaling** - add languages as business grows
- 🔒 **Disable languages** - temporarily without deleting data
- 📊 **Centralized config** - easy to audit what's supported
- ⚡ **Hot swappable** - can change config without schema migration

### Business Benefits
- 💰 **Lower cost** - less developer time
- 🚀 **Faster time-to-market** - quicker language rollouts
- 🌍 **Global expansion** - easy to add markets
- 🔄 **A/B testing** - enable languages for subset of users
- 📈 **Scalability** - supports 50+ languages if needed

---

## 🎓 When to Use Each Approach

### Use Hardcoded When:
- ❌ Fixed language set (never changing)
- ❌ Very small project (< 3 languages)
- ❌ Compile-time validation is critical
- ❌ No plans to add languages ever

### Use Dynamic When:
- ✅ Languages may change over time **(recommended)**
- ✅ Multiple languages (4+)
- ✅ Global product / multi-market
- ✅ Need to enable/disable languages
- ✅ Want cleaner, more maintainable code
- ✅ Plan to scale internationally

---

**Recommendation:** Use the **dynamic approach** for any serious multilingual application. The maintenance benefits far outweigh the minimal runtime validation cost.

---

**Last Updated:** 2024-11-19
