/**
 * Canonical feed product — the single intermediate representation every
 * destination adapter consumes. Built from a lean pimproducts document.
 * Pure module: no DB, no I/O (safe for unit tests and client bundles).
 */
import { createHash } from "crypto";

export interface FeedProduct {
  entity_code: string;
  sku: string;
  title: string;
  description: string;
  link: string;
  image_link?: string;
  additional_image_links: string[];
  availability: "in_stock" | "out_of_stock" | "preorder";
  quantity: number;
  price: number;
  sale_price?: number;
  currency: string;
  gtin?: string;
  brand?: string;
  category_path?: string;
  condition: "new";
}

export interface CanonicalOptions {
  lang: string;
  channel: string;
  currency: string;
  productUrlTemplate: string;
}

type ML = Record<string, string> | undefined | null;

function pickLang(map: ML, lang: string): string {
  if (!map || typeof map !== "object") return "";
  if (map[lang]) return map[lang];
  const first = Object.values(map).find((v) => typeof v === "string" && v);
  return first || "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function resolveAvailability(p: Record<string, unknown>): FeedProduct["availability"] {
  const s = p.stock_status as string | undefined;
  if (s === "pre_order") return "preorder";
  if (s === "in_stock") return "in_stock";
  if (s === "out_of_stock") return "out_of_stock";
  return ((p.quantity as number) || 0) > 0 ? "in_stock" : "out_of_stock";
}

function resolveCategoryPath(
  p: Record<string, unknown>,
  channel: string,
  lang: string
): string | undefined {
  // Prefer the channel-specific category, fall back to the base category —
  // mirrors categoryForChannel() in b2b-product-resolver.service.ts.
  const channelCats = p.channel_categories as
    | { channel_code: string; category?: Record<string, unknown> }[]
    | undefined;
  const cat =
    channelCats?.find((c) => c.channel_code === channel)?.category ??
    (p.category as Record<string, unknown> | undefined);
  if (!cat) return undefined;
  // hierarchy holds ANCESTORS ONLY (see buildCategoryEmbedding in
  // category.service.ts) — the leaf category's own name lives in cat.name,
  // so append it after the ancestor names.
  const hierarchy = cat.hierarchy as { name?: ML }[] | undefined;
  const names = (hierarchy ?? [])
    .map((h) => pickLang(h.name as ML, lang))
    .filter(Boolean);
  const leaf = pickLang(cat.name as ML, lang);
  if (leaf && leaf !== names[names.length - 1]) names.push(leaf);
  return names.length ? names.join(" > ") : undefined;
}

export function buildFeedProduct(
  product: Record<string, unknown>,
  opts: CanonicalOptions
): FeedProduct | null {
  const title = pickLang(product.name as ML, opts.lang);
  if (!title) return null;

  const entityCode =
    product.entity_code == null ? "" : String(product.entity_code);
  if (!entityCode) return null;

  const pricing = (product.pricing as Record<string, unknown>) || {};
  const list = Number(pricing.list) || 0;
  if (list <= 0) return null;
  const sale = Number(pricing.sale) || 0;

  const slug = pickLang(product.slug as ML, opts.lang);
  const link = opts.productUrlTemplate
    .replace("{slug}", slug || entityCode)
    .replace("{entity_code}", entityCode);

  const images = ((product.images as { url: string; position?: number }[]) || [])
    .filter((i) => i?.url)
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const eans = (product.ean as string[]) || [];
  const brand = (product.brand as { label?: string } | undefined)?.label;

  const fp: FeedProduct = {
    entity_code: entityCode,
    sku: String(product.sku || entityCode),
    title,
    description:
      stripHtml(
        pickLang(product.description as ML, opts.lang) ||
          pickLang(product.short_description as ML, opts.lang)
      ) || title,
    link,
    image_link: images[0]?.url,
    additional_image_links: images.slice(1, 11).map((i) => i.url),
    availability: resolveAvailability(product),
    quantity: Number(product.quantity) || 0,
    price: list,
    currency: String(pricing.currency || opts.currency),
    gtin: eans[0],
    brand,
    category_path: resolveCategoryPath(product, opts.channel, opts.lang),
    condition: "new",
  };
  if (sale > 0 && sale < list) fp.sale_price = sale;
  return fp;
}

export function feedContentHash(fp: FeedProduct): string {
  // Stable key order via explicit tuple — never JSON.stringify the raw object.
  const stable = JSON.stringify([
    fp.entity_code, fp.sku, fp.title, fp.description, fp.link,
    fp.image_link ?? "", fp.additional_image_links, fp.availability,
    fp.quantity, fp.price, fp.sale_price ?? null, fp.currency,
    fp.gtin ?? "", fp.brand ?? "", fp.category_path ?? "", fp.condition,
  ]);
  return createHash("sha256").update(stable).digest("hex");
}
