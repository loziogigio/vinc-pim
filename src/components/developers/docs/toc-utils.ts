import type { TocItem } from "./DocsTOC";

/**
 * Build a table-of-contents list from raw MDX source.
 *
 * Only H2 / H3 headings are indexed; slugging must match rehype-slug's
 * GitHub-style algorithm so anchor hrefs match the DOM ids that the
 * rehype plugin emits at render time.
 */
export function extractTocFromMdx(source: string): TocItem[] {
  const items: TocItem[] = [];
  const usedIds = new Set<string>();
  const fenceRe = /```[\s\S]*?```/g;
  const stripped = source.replace(fenceRe, "");
  const lines = stripped.split("\n");

  for (const line of lines) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const depth = match[1].length as 2 | 3;
    const text = match[2].replace(/[`*_]/g, "").trim();
    if (!text) continue;
    const baseId = slugify(text);
    let id = baseId;
    let n = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${n++}`;
    }
    usedIds.add(id);
    items.push({ id, text, depth });
  }
  return items;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}
