/**
 * VINC Demo — canonical published home-page blocks for the B2B portal.
 * Captured once here so provision AND --hard reset re-publish the exact same
 * branded home page (no manual page-builder authoring, no empty state).
 *
 * Block shape is what saveDraftInPortal sanitizes to: { id, type, order, config, metadata }.
 */
export interface HomeBlock {
  id: string;
  type: string;
  order: number;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const CANONICAL_HOME_BLOCKS: HomeBlock[] = [
  {
    id: "demo-hero",
    type: "hero",
    order: 0,
    config: {
      title: { it: "Forniture industriali per professionisti", en: "Industrial supplies for professionals" },
      subtitle: { it: "Utensili, fissaggi, abrasivi e DPI — il tuo prezzo riservato.", en: "Tools, fasteners, abrasives and PPE — your reserved price." },
      cta: { label: { it: "Sfoglia il catalogo", en: "Browse the catalog" }, href: "/search" },
      backgroundImage: "https://cdn.vendereincloud.it/vinc-demo-it/demo/brand/hero.jpg",
    },
  },
  {
    id: "demo-featured",
    type: "featured-products",
    order: 1,
    config: {
      title: { it: "Più venduti", en: "Bestsellers" },
      source: "tag",
      tag: "bestseller",
      limit: 12,
    },
  },
  {
    id: "demo-categories",
    type: "category-grid",
    order: 2,
    config: {
      title: { it: "Reparti", en: "Departments" },
      categories: [
        { slug: "utensili-elettrici", label: { it: "Utensili elettrici", en: "Power Tools" } },
        { slug: "utensili-mano", label: { it: "Utensili a mano", en: "Hand Tools" } },
        { slug: "fissaggi", label: { it: "Viteria & fissaggi", en: "Fasteners & Fixings" } },
        { slug: "abrasivi", label: { it: "Abrasivi", en: "Abrasives" } },
        { slug: "elettrico", label: { it: "Materiale elettrico", en: "Electrical Supplies" } },
        { slug: "dpi", label: { it: "DPI", en: "PPE" } },
      ],
    },
  },
  {
    id: "demo-promo",
    type: "promo-banner",
    order: 3,
    config: {
      text: { it: "Sconti riservati ai rivenditori — accedi per vedere il tuo prezzo", en: "Reseller-only discounts — sign in to see your price" },
      backgroundColor: "#f59e0b",
      textColor: "#111827",
    },
  },
];

export const DEMO_HOME_SEO = {
  title: "Velia Ferramenta — Forniture industriali",
  description: "Demo B2B VINC: utensili, fissaggi, abrasivi e DPI con prezzi riservati per rivenditore.",
};
