/**
 * Meta (Facebook/Instagram Shops) adapter — FeedProduct -> items_batch
 * request entries. Prices are integer MINOR units (cents) + currency field.
 */
import type { FeedProduct } from "../canonical";

const META_AVAILABILITY: Record<FeedProduct["availability"], string> = {
  in_stock: "in stock",
  out_of_stock: "out of stock",
  preorder: "preorder",
};

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function toMetaBatchRequest(fp: FeedProduct): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: fp.title,
    description: fp.description,
    url: fp.link,
    availability: META_AVAILABILITY[fp.availability],
    condition: fp.condition,
    price: toCents(fp.price),
    currency: fp.currency,
  };
  if (fp.image_link) data.image_url = fp.image_link;
  if (fp.additional_image_links.length)
    data.additional_image_urls = fp.additional_image_links;
  if (fp.sale_price !== undefined) data.sale_price = toCents(fp.sale_price);
  if (fp.gtin) data.gtin = fp.gtin;
  if (fp.brand) data.brand = fp.brand;
  if (fp.category_path) data.category = fp.category_path;

  return { method: "UPDATE", retailer_id: fp.entity_code, data };
}

export function toMetaDeleteRequest(entityCode: string): Record<string, unknown> {
  return { method: "DELETE", retailer_id: entityCode };
}
