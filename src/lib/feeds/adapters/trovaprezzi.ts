/**
 * TrovaPrezzi adapter — FeedProduct[] -> the XML feed TrovaPrezzi fetches.
 * Tag set follows the TrovaPrezzi merchant feed spec; all field naming is
 * centralized here so spec adjustments stay one-file changes.
 */
import type { FeedProduct } from "../canonical";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(amount: number): string {
  return amount.toFixed(2);
}

export function buildTrovaPrezziXml(
  products: FeedProduct[],
  opts: { shippingCost?: number }
): string {
  const shipping = money(opts.shippingCost ?? 0);
  const offers = products
    .map((fp) => {
      const effective = fp.sale_price !== undefined ? fp.sale_price : fp.price;
      const parts = [
        `<Name>${esc(fp.title)}</Name>`,
        `<Code>${esc(fp.entity_code)}</Code>`,
        `<Description>${esc(fp.description)}</Description>`,
        `<Link>${esc(fp.link)}</Link>`,
        `<Price>${money(effective)}</Price>`,
      ];
      if (fp.sale_price !== undefined)
        parts.push(`<ListPrice>${money(fp.price)}</ListPrice>`);
      if (fp.brand) parts.push(`<Brand>${esc(fp.brand)}</Brand>`);
      if (fp.gtin) parts.push(`<EanCode>${esc(fp.gtin)}</EanCode>`);
      if (fp.image_link) parts.push(`<Image>${esc(fp.image_link)}</Image>`);
      if (fp.category_path)
        parts.push(`<Categories>${esc(fp.category_path)}</Categories>`);
      parts.push(`<ShippingCost>${shipping}</ShippingCost>`);
      // TrovaPrezzi expects a whole-unit stock count; this platform allows
      // decimal purchasable quantities (e.g. 0.125 = 1/8 of a packaging
      // unit), so floor rather than emit a fraction the feed spec rejects.
      parts.push(`<Stock>${Math.floor(fp.quantity)}</Stock>`);
      return `<Offer>${parts.join("")}</Offer>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Products>${offers}</Products>`;
}
