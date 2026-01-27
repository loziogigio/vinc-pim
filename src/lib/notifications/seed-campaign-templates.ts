/**
 * Campaign Seed Templates
 *
 * Basic templates for the 2 template types (product and generic)
 * that can be sent via 3 channels (email, mobile, web_in_app).
 */

import type { INotificationTemplate, TemplateType } from "@/lib/constants/notification";

// ============================================
// HTML GENERATORS
// ============================================

/**
 * Generate email HTML for product template
 */
function generateProductEmailHtml(): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333; margin-bottom: 16px;">{{title}}</h1>
  <p style="color: #666; font-size: 16px; line-height: 1.6;">{{body}}</p>

  <!-- Products Grid -->
  <div style="margin-top: 24px;">
    {{#each products}}
    <div style="display: inline-block; width: 48%; vertical-align: top; margin-bottom: 16px; padding: 12px; border: 1px solid #eee; border-radius: 8px;">
      <img src="{{image}}" alt="{{name}}" style="width: 100%; height: 150px; object-fit: contain; margin-bottom: 8px;" />
      <p style="font-size: 12px; color: #999; margin: 0;">{{sku}}</p>
      <p style="font-size: 14px; font-weight: 600; color: #333; margin: 4px 0 0 0;">{{name}}</p>
    </div>
    {{/each}}
  </div>

  <div style="margin-top: 24px; text-align: center;">
    <a href="{{action_url}}" style="display: inline-block; background: #007bff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Visualizza Prodotti
    </a>
  </div>
</div>
`.trim();
}

/**
 * Generate email HTML for generic template
 */
function generateGenericEmailHtml(): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333; margin-bottom: 16px;">{{title}}</h1>

  {{#if image}}
  <div style="margin-bottom: 20px;">
    <img src="{{image}}" alt="{{title}}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px;" />
  </div>
  {{/if}}

  <p style="color: #666; font-size: 16px; line-height: 1.6;">{{body}}</p>

  {{#if url}}
  <div style="margin-top: 24px; text-align: center;">
    <a href="{{url}}" style="display: inline-block; background: #007bff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;" {{#if open_in_new_tab}}target="_blank"{{/if}}>
      Scopri di più
    </a>
  </div>
  {{/if}}
</div>
`.trim();
}

// ============================================
// SEED TEMPLATES
// ============================================

export interface SeedCampaignTemplate extends Partial<INotificationTemplate> {
  template_id: string;
  name: string;
  type: TemplateType;
  trigger: string;
  title: string;
  body: string;
}

/**
 * Product template - for product notifications (back_in_stock, price_drop, new_arrivals)
 */
export const PRODUCT_TEMPLATE: SeedCampaignTemplate = {
  template_id: "campaign-product",
  name: "Campagna Prodotti",
  description: "Template per notifiche relative a prodotti (disponibilità, novità, promozioni)",
  type: "product",
  trigger: "back_in_stock",
  title: "Prodotti Disponibili",
  body: "Alcuni prodotti che potrebbero interessarti sono ora disponibili.",
  products: [],
  filters: undefined,
  template_channels: {
    email: {
      enabled: true,
      subject: "{{title}}",
      html_body: generateProductEmailHtml(),
    },
    mobile: {
      enabled: true,
    },
    web_in_app: {
      enabled: true,
      icon: undefined,
      action_url: undefined,
    },
  },
  use_default_header: true,
  use_default_footer: true,
  is_active: true,
  is_default: true,
  variables: ["title", "body", "products", "action_url"],
};

/**
 * Generic template - for announcements, newsletters, promotions
 */
export const GENERIC_TEMPLATE: SeedCampaignTemplate = {
  template_id: "campaign-generic",
  name: "Comunicazione Generica",
  description: "Template per comunicazioni generiche (newsletter, annunci, promozioni)",
  type: "generic",
  trigger: "newsletter",
  title: "Nuova Comunicazione",
  body: "Ecco le ultime novità dal nostro negozio.",
  url: undefined,
  image: undefined,
  open_in_new_tab: true,
  template_channels: {
    email: {
      enabled: true,
      subject: "{{title}}",
      html_body: generateGenericEmailHtml(),
    },
    mobile: {
      enabled: true,
    },
    web_in_app: {
      enabled: true,
      icon: undefined,
      action_url: "{{url}}",
    },
  },
  use_default_header: true,
  use_default_footer: true,
  is_active: true,
  is_default: true,
  variables: ["title", "body", "image", "url", "open_in_new_tab"],
};

/**
 * All campaign seed templates
 */
export const CAMPAIGN_SEED_TEMPLATES: SeedCampaignTemplate[] = [
  PRODUCT_TEMPLATE,
  GENERIC_TEMPLATE,
];

// ============================================
// MOBILE PAYLOAD GENERATORS
// ============================================

/**
 * Generate mobile payload for product notification.
 * Uses the same structure we tested before.
 */
export function generateProductPayload(
  products: Array<{ sku: string; name: string; image: string; item_ref: string }>,
  filters?: Record<string, string[]>
) {
  return {
    category: "product" as const,
    products: products.map((p) => ({
      sku: p.sku,
      name: p.name,
      image: p.image,
      item_ref: p.item_ref,
    })),
    filters: filters || (products.length > 0 ? { sku: products.map((p) => p.sku) } : undefined),
    media: {
      images: products.map((p) => p.image).filter(Boolean),
    },
  };
}

/**
 * Generate mobile payload for generic notification.
 */
export function generateGenericPayload(url?: string, image?: string, openInNewTab = true) {
  return {
    category: "generic" as const,
    url,
    open_in_new_tab: openInNewTab,
    media: image ? { image } : undefined,
  };
}
