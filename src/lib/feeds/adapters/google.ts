/**
 * Google Merchant adapter — FeedProduct -> Merchant API productInput body.
 * Pure serializer; the HTTP push lives in clients/google-client.ts.
 * Availability values use Google's space-separated strings.
 */
import type { FeedProduct } from "../canonical";

export interface GoogleAdapterOptions {
  contentLanguage: string; // e.g. "it"
  feedLabel: string; // e.g. "IT"
}

const GOOGLE_AVAILABILITY: Record<FeedProduct["availability"], string> = {
  in_stock: "in stock",
  out_of_stock: "out of stock",
  preorder: "preorder",
};

function toMicros(amount: number): string {
  return String(Math.round(amount * 1_000_000));
}

export function googleOfferId(fp: FeedProduct): string {
  return fp.entity_code;
}

export function toGoogleProductInput(
  fp: FeedProduct,
  opts: GoogleAdapterOptions
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {
    title: fp.title,
    description: fp.description,
    link: fp.link,
    availability: GOOGLE_AVAILABILITY[fp.availability],
    condition: fp.condition,
    price: { amountMicros: toMicros(fp.price), currencyCode: fp.currency },
  };
  if (fp.image_link) attributes.imageLink = fp.image_link;
  if (fp.additional_image_links.length)
    attributes.additionalImageLinks = fp.additional_image_links;
  if (fp.sale_price !== undefined)
    attributes.salePrice = {
      amountMicros: toMicros(fp.sale_price),
      currencyCode: fp.currency,
    };
  if (fp.gtin) attributes.gtin = fp.gtin;
  if (fp.brand) attributes.brand = fp.brand;
  if (fp.category_path) attributes.productTypes = [fp.category_path];

  return {
    channel: "ONLINE",
    offerId: googleOfferId(fp),
    contentLanguage: opts.contentLanguage,
    feedLabel: opts.feedLabel,
    attributes,
  };
}
