import {
  FACET_FIELDS_CONFIG,
  isSpecificationField,
  isAttributeField,
  getFacetConfig,
} from "@/lib/search/facet-config";
import type { FacetType } from "@/lib/types/search";

export interface DiscoveredFacetField {
  field: string;
  label: string;
  type: FacetType;
  source: "static" | "attribute" | "spec";
}

/**
 * Build the merged list of facetable fields from the static config plus any
 * dynamic attribute_ and spec_ fields present in the given Solr Luke field map.
 * `lukeFields` is the `fields` object from Solr's Luke handler response.
 * Pass `{}` to get static fields only.
 */
export function buildDiscoveredFacetFields(
  lukeFields: Record<string, unknown>,
): DiscoveredFacetField[] {
  const seen = new Set<string>();
  const out: DiscoveredFacetField[] = [];

  for (const [field, cfg] of Object.entries(FACET_FIELDS_CONFIG)) {
    seen.add(field);
    out.push({ field, label: cfg.label, type: cfg.type, source: "static" });
  }

  for (const field of Object.keys(lukeFields || {})) {
    if (seen.has(field)) continue;
    if (field.startsWith("spec_labels_")) continue;
    const isSpec = isSpecificationField(field);
    const isAttr = isAttributeField(field);
    if (!isSpec && !isAttr) continue;
    const cfg = getFacetConfig(field);
    if (!cfg) continue;
    seen.add(field);
    out.push({
      field,
      label: cfg.label,
      type: cfg.type,
      source: isSpec ? "spec" : "attribute",
    });
  }

  return out;
}
