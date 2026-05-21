import { SLUG_MAX_LENGTH } from "@/lib/db/models/data-model-definition";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}
