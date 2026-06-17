/**
 * VINC Demo — Fictional Neutral Catalog (Phase A / task A1)
 *
 * Deterministic, fictional, brand-neutral product catalog used to seed the
 * shared `vinc-demo` tenant. Neutral general-goods range (office, lighting,
 * kitchen, cleaning, packaging, electronics) so it shows well to ANY prospect
 * and never exposes a real customer's products/branding.
 *
 * Bilingual IT/EN (platform launches IT+EN). Every product is visible on both
 * the `b2b` and `b2c` channels. Output objects are shaped to be passed straight
 * to `PIMProductModel.create()` (see scripts/demo/provision-demo-tenant.ts).
 *
 * Deterministic on purpose: the nightly demo reset re-seeds from here and must
 * produce byte-identical catalog state every run (no Math.random / no Date in
 * the product identity fields).
 */

export const DEMO_SOURCE = {
  source_id: "demo-seed",
  source_name: "VINC Demo Seed",
} as const;

/** Both demo surfaces read the same catalog. */
export const DEMO_CHANNELS = ["b2b", "b2c"] as const;

type Bi = { it: string; en: string };

export interface DemoCategory {
  code: string;
  name: Bi;
}

export interface DemoBrand {
  code: string;
  label: string;
}

export interface DemoSpec {
  key: string;
  label: Bi;
  value: string;
  uom?: string;
}

export interface DemoTemplate {
  code: string; // entity_code suffix; full code = DEMO-<code>
  cat: string; // category code
  brand: string; // brand code
  name: Bi;
  short: Bi;
  list: number; // wholesale / cost price (net)
  retail: number; // suggested retail (net)
  stock: number;
  weight_g: number;
  pack_code?: string; // optional bulk packaging code (e.g. "BOX")
  pack_qty?: number; // units per bulk packaging
  features: { it: string[]; en: string[] };
  specs: DemoSpec[];
  bestseller?: boolean;
}

export const DEMO_CATEGORIES: DemoCategory[] = [
  { code: "utensili-elettrici", name: { it: "Utensili elettrici", en: "Power Tools" } },
  { code: "utensili-mano", name: { it: "Utensili a mano", en: "Hand Tools" } },
  { code: "fissaggi", name: { it: "Viteria & fissaggi", en: "Fasteners & Fixings" } },
  { code: "abrasivi", name: { it: "Abrasivi", en: "Abrasives" } },
  { code: "elettrico", name: { it: "Materiale elettrico", en: "Electrical Supplies" } },
  { code: "dpi", name: { it: "DPI", en: "PPE" } },
];

export const DEMO_BRANDS: DemoBrand[] = [
  { code: "forgia", label: "Forgia" },
  { code: "tenax", label: "Tenax" },
  { code: "vortek", label: "Vortek" },
  { code: "granito", label: "Granito" },
  { code: "elettron", label: "Elettron" },
  { code: "scudo", label: "Scudo" },
];

const f = (it: string[], en: string[]) => ({ it, en });

const TEMPLATES: DemoTemplate[] = [
  // ── Office ───────────────────────────────────────────────────────────────
  {
    code: "OFF-01", cat: "office", brand: "aurora",
    name: { it: "Quaderno A4 a righe", en: "A4 Ruled Notebook" },
    short: { it: "Quaderno A4 con copertina rigida, 192 pagine", en: "A4 hardcover notebook, 192 pages" },
    list: 1.9, retail: 3.9, stock: 480, weight_g: 320, pack_code: "BOX", pack_qty: 12,
    features: f(["Copertina rigida", "Carta 90 g/m²", "192 pagine"], ["Hardcover", "90 gsm paper", "192 pages"]),
    specs: [
      { key: "format", label: { it: "Formato", en: "Format" }, value: "A4" },
      { key: "pages", label: { it: "Pagine", en: "Pages" }, value: "192" },
    ],
    bestseller: true,
  },
  {
    code: "OFF-02", cat: "office", brand: "aurora",
    name: { it: "Penne gel nere (conf. 12)", en: "Black Gel Pens (pack of 12)" },
    short: { it: "Penne gel a scrittura morbida, punta 0,7 mm", en: "Smooth-writing gel pens, 0.7 mm tip" },
    list: 3.2, retail: 6.5, stock: 360, weight_g: 180, pack_code: "BOX", pack_qty: 10,
    features: f(["Inchiostro a base gel", "Punta 0,7 mm", "Confezione da 12"], ["Gel-based ink", "0.7 mm tip", "Pack of 12"]),
    specs: [
      { key: "tip", label: { it: "Punta", en: "Tip" }, value: "0.7", uom: "mm" },
      { key: "qty", label: { it: "Quantità", en: "Quantity" }, value: "12" },
    ],
  },
  {
    code: "OFF-03", cat: "office", brand: "aurora",
    name: { it: "Organizer da scrivania", en: "Desk Organizer" },
    short: { it: "Portaoggetti multiscomparto in metallo", en: "Multi-compartment metal desk tidy" },
    list: 7.5, retail: 14.9, stock: 140, weight_g: 720,
    features: f(["5 scomparti", "Struttura in metallo", "Base antiscivolo"], ["5 compartments", "Metal frame", "Non-slip base"]),
    specs: [
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Metal" },
      { key: "slots", label: { it: "Scomparti", en: "Compartments" }, value: "5" },
    ],
  },
  {
    code: "OFF-04", cat: "office", brand: "aurora",
    name: { it: "Risma carta A4 80g (500 fogli)", en: "A4 Paper Ream 80g (500 sheets)" },
    short: { it: "Carta multiuso bianca per stampa e copia", en: "White multipurpose print & copy paper" },
    list: 3.8, retail: 6.9, stock: 600, weight_g: 2500, pack_code: "BOX", pack_qty: 5,
    features: f(["80 g/m²", "500 fogli", "Bianco brillante"], ["80 gsm", "500 sheets", "Bright white"]),
    specs: [
      { key: "weight", label: { it: "Grammatura", en: "Weight" }, value: "80", uom: "g/m²" },
      { key: "sheets", label: { it: "Fogli", en: "Sheets" }, value: "500" },
    ],
  },
  // ── Lighting ─────────────────────────────────────────────────────────────
  {
    code: "LGT-01", cat: "lighting", brand: "lumen",
    name: { it: "Lampada LED da tavolo", en: "LED Desk Lamp" },
    short: { it: "Lampada da tavolo dimmerabile con porta USB", en: "Dimmable desk lamp with USB port" },
    list: 12.5, retail: 24.9, stock: 95, weight_g: 640,
    features: f(["3 temperature colore", "Dimmerabile", "Porta USB di ricarica"], ["3 colour temperatures", "Dimmable", "USB charging port"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "8", uom: "W" },
      { key: "cct", label: { it: "Temperatura colore", en: "Colour temp" }, value: "3000–6000", uom: "K" },
    ],
    bestseller: true,
  },
  {
    code: "LGT-02", cat: "lighting", brand: "lumen",
    name: { it: "Faretti LED GU10 (conf. 5)", en: "LED Spotlights GU10 (pack of 5)" },
    short: { it: "Faretti LED a basso consumo, luce bianca naturale", en: "Low-consumption LED spotlights, natural white" },
    list: 9.0, retail: 18.5, stock: 210, weight_g: 300, pack_code: "BOX", pack_qty: 10,
    features: f(["5 W per faretto", "Luce 4000 K", "Confezione da 5"], ["5 W each", "4000 K light", "Pack of 5"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "5", uom: "W" },
      { key: "socket", label: { it: "Attacco", en: "Socket" }, value: "GU10" },
    ],
  },
  {
    code: "LGT-03", cat: "lighting", brand: "lumen",
    name: { it: "Striscia LED 5m RGB", en: "LED Strip 5m RGB" },
    short: { it: "Striscia LED adesiva con telecomando", en: "Self-adhesive LED strip with remote" },
    list: 8.5, retail: 17.9, stock: 175, weight_g: 250,
    features: f(["16 colori", "Telecomando incluso", "Adesivo 3M"], ["16 colours", "Remote included", "3M adhesive"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "5", uom: "m" },
      { key: "type", label: { it: "Tipo", en: "Type" }, value: "RGB" },
    ],
  },
  {
    code: "LGT-04", cat: "lighting", brand: "lumen",
    name: { it: "Plafoniera LED 24W", en: "LED Ceiling Light 24W" },
    short: { it: "Plafoniera tonda ultrasottile per interni", en: "Ultra-slim round indoor ceiling light" },
    list: 14.0, retail: 29.0, stock: 120, weight_g: 900,
    features: f(["24 W", "2200 lumen", "Installazione rapida"], ["24 W", "2200 lumen", "Quick install"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "24", uom: "W" },
      { key: "lumen", label: { it: "Flusso", en: "Lumen" }, value: "2200", uom: "lm" },
    ],
  },
  // ── Kitchen ──────────────────────────────────────────────────────────────
  {
    code: "KIT-01", cat: "kitchen", brand: "nordkitchen",
    name: { it: "Set 4 tazze in porcellana", en: "Porcelain Mug Set of 4" },
    short: { it: "Tazze da 350 ml lavabili in lavastoviglie", en: "350 ml dishwasher-safe mugs" },
    list: 8.0, retail: 16.9, stock: 160, weight_g: 1400, pack_code: "BOX", pack_qty: 6,
    features: f(["350 ml", "Lavastoviglie", "Set da 4"], ["350 ml", "Dishwasher safe", "Set of 4"]),
    specs: [
      { key: "capacity", label: { it: "Capacità", en: "Capacity" }, value: "350", uom: "ml" },
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "4" },
    ],
  },
  {
    code: "KIT-02", cat: "kitchen", brand: "nordkitchen",
    name: { it: "Tagliere in bambù", en: "Bamboo Cutting Board" },
    short: { it: "Tagliere robusto con scanalatura raccogli-sugo", en: "Sturdy board with juice groove" },
    list: 5.5, retail: 12.5, stock: 220, weight_g: 800,
    features: f(["Bambù naturale", "Scanalatura perimetrale", "38 × 28 cm"], ["Natural bamboo", "Perimeter groove", "38 × 28 cm"]),
    specs: [
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Bamboo" },
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "38 × 28", uom: "cm" },
    ],
  },
  {
    code: "KIT-03", cat: "kitchen", brand: "nordkitchen",
    name: { it: "Set coltelli 5 pezzi", en: "5-Piece Knife Set" },
    short: { it: "Coltelli in acciaio inox con ceppo", en: "Stainless steel knives with block" },
    list: 18.0, retail: 39.0, stock: 70, weight_g: 1600,
    features: f(["Acciaio inox", "Ceppo incluso", "5 pezzi"], ["Stainless steel", "Block included", "5 pieces"]),
    specs: [
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Stainless steel" },
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "5" },
    ],
    bestseller: true,
  },
  {
    code: "KIT-04", cat: "kitchen", brand: "nordkitchen",
    name: { it: "Bottiglia termica 750ml", en: "Insulated Bottle 750ml" },
    short: { it: "Bottiglia in acciaio, 12h caldo / 24h freddo", en: "Steel bottle, 12h hot / 24h cold" },
    list: 7.0, retail: 15.9, stock: 300, weight_g: 350, pack_code: "BOX", pack_qty: 12,
    features: f(["Doppia parete", "750 ml", "Senza BPA"], ["Double wall", "750 ml", "BPA-free"]),
    specs: [
      { key: "capacity", label: { it: "Capacità", en: "Capacity" }, value: "750", uom: "ml" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Stainless steel" },
    ],
  },
  // ── Cleaning ─────────────────────────────────────────────────────────────
  {
    code: "CLN-01", cat: "cleaning", brand: "puravita",
    name: { it: "Detergente multiuso 5L", en: "Multipurpose Cleaner 5L" },
    short: { it: "Concentrato professionale per ogni superficie", en: "Professional concentrate for all surfaces" },
    list: 6.5, retail: 12.9, stock: 240, weight_g: 5200, pack_code: "BOX", pack_qty: 4,
    features: f(["Concentrato", "Profumo agrumi", "Tanica 5 L"], ["Concentrated", "Citrus scent", "5 L canister"]),
    specs: [
      { key: "volume", label: { it: "Volume", en: "Volume" }, value: "5", uom: "L" },
      { key: "type", label: { it: "Tipo", en: "Type" }, value: "Concentrate" },
    ],
  },
  {
    code: "CLN-02", cat: "cleaning", brand: "puravita",
    name: { it: "Panni microfibra (conf. 10)", en: "Microfibre Cloths (pack of 10)" },
    short: { it: "Panni assorbenti lavabili in lavatrice", en: "Absorbent machine-washable cloths" },
    list: 4.0, retail: 8.9, stock: 400, weight_g: 320, pack_code: "BOX", pack_qty: 20,
    features: f(["Microfibra 300 g/m²", "Lavabili", "30 × 30 cm"], ["300 gsm microfibre", "Washable", "30 × 30 cm"]),
    specs: [
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "10" },
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "30 × 30", uom: "cm" },
    ],
  },
  {
    code: "CLN-03", cat: "cleaning", brand: "puravita",
    name: { it: "Guanti in nitrile (conf. 100)", en: "Nitrile Gloves (box of 100)" },
    short: { it: "Guanti monouso senza polvere, taglia M", en: "Powder-free disposable gloves, size M" },
    list: 5.0, retail: 10.9, stock: 350, weight_g: 600, pack_code: "BOX", pack_qty: 10,
    features: f(["Senza polvere", "Senza lattice", "100 pezzi"], ["Powder-free", "Latex-free", "100 pieces"]),
    specs: [
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "100" },
      { key: "size", label: { it: "Taglia", en: "Size" }, value: "M" },
    ],
    bestseller: true,
  },
  {
    code: "CLN-04", cat: "cleaning", brand: "puravita",
    name: { it: "Sapone mani igienizzante 1L", en: "Sanitising Hand Soap 1L" },
    short: { it: "Sapone liquido con dosatore, delicato sulla pelle", en: "Liquid soap with pump, skin-friendly" },
    list: 3.0, retail: 6.5, stock: 280, weight_g: 1100, pack_code: "BOX", pack_qty: 12,
    features: f(["Con dosatore", "pH bilanciato", "1 L"], ["With pump", "Balanced pH", "1 L"]),
    specs: [
      { key: "volume", label: { it: "Volume", en: "Volume" }, value: "1", uom: "L" },
    ],
  },
  // ── Packaging ────────────────────────────────────────────────────────────
  {
    code: "PKG-01", cat: "packaging", brand: "packpro",
    name: { it: "Scatole spedizione (conf. 20)", en: "Shipping Boxes (pack of 20)" },
    short: { it: "Scatole in cartone ondulato doppia onda", en: "Double-wall corrugated cardboard boxes" },
    list: 9.0, retail: 17.9, stock: 190, weight_g: 4000,
    features: f(["Doppia onda", "30 × 20 × 15 cm", "Confezione da 20"], ["Double wall", "30 × 20 × 15 cm", "Pack of 20"]),
    specs: [
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "20" },
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "30 × 20 × 15", uom: "cm" },
    ],
  },
  {
    code: "PKG-02", cat: "packaging", brand: "packpro",
    name: { it: "Nastro adesivo (conf. 6)", en: "Packing Tape (pack of 6)" },
    short: { it: "Nastro da imballo trasparente 50 mm × 66 m", en: "Clear packing tape 50 mm × 66 m" },
    list: 4.5, retail: 9.5, stock: 320, weight_g: 900, pack_code: "BOX", pack_qty: 6,
    features: f(["50 mm × 66 m", "Adesivo forte", "Confezione da 6"], ["50 mm × 66 m", "Strong adhesive", "Pack of 6"]),
    specs: [
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "50 mm × 66 m" },
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "6" },
    ],
  },
  {
    code: "PKG-03", cat: "packaging", brand: "packpro",
    name: { it: "Pluriball 100m", en: "Bubble Wrap 100m" },
    short: { it: "Rotolo di pluriball protettivo, altezza 50 cm", en: "Protective bubble wrap roll, 50 cm wide" },
    list: 11.0, retail: 21.9, stock: 110, weight_g: 3500,
    features: f(["Rotolo 100 m", "Altezza 50 cm", "Bolle d'aria protettive"], ["100 m roll", "50 cm wide", "Protective air bubbles"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "100", uom: "m" },
      { key: "width", label: { it: "Altezza", en: "Width" }, value: "50", uom: "cm" },
    ],
  },
  {
    code: "PKG-04", cat: "packaging", brand: "packpro",
    name: { it: "Buste imbottite (conf. 50)", en: "Padded Envelopes (pack of 50)" },
    short: { it: "Buste con imbottitura a bolle, formato C/3", en: "Bubble-lined mailers, size C/3" },
    list: 7.5, retail: 15.5, stock: 200, weight_g: 1800, pack_code: "BOX", pack_qty: 4,
    features: f(["Imbottitura a bolle", "Chiusura adesiva", "50 pezzi"], ["Bubble lining", "Peel-and-seal", "50 pieces"]),
    specs: [
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "50" },
      { key: "size", label: { it: "Formato", en: "Format" }, value: "C/3" },
    ],
  },
  // ── Electronics ──────────────────────────────────────────────────────────
  {
    code: "ELC-01", cat: "electronics", brand: "voltplus",
    name: { it: "Caricatore USB-C 65W", en: "USB-C Charger 65W" },
    short: { it: "Caricatore compatto GaN per laptop e telefono", en: "Compact GaN charger for laptop & phone" },
    list: 13.0, retail: 27.9, stock: 150, weight_g: 140, pack_code: "BOX", pack_qty: 10,
    features: f(["Tecnologia GaN", "65 W Power Delivery", "Compatto"], ["GaN technology", "65 W Power Delivery", "Compact"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "65", uom: "W" },
      { key: "port", label: { it: "Porta", en: "Port" }, value: "USB-C" },
    ],
    bestseller: true,
  },
  {
    code: "ELC-02", cat: "electronics", brand: "voltplus",
    name: { it: "Cavi USB-C (conf. 3)", en: "USB-C Cables (pack of 3)" },
    short: { it: "Cavi intrecciati 1 m, ricarica e dati 60W", en: "Braided 1 m cables, 60W charge & data" },
    list: 6.0, retail: 13.5, stock: 260, weight_g: 240, pack_code: "BOX", pack_qty: 12,
    features: f(["Intrecciati in nylon", "60 W", "Confezione da 3"], ["Nylon braided", "60 W", "Pack of 3"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "1", uom: "m" },
      { key: "qty", label: { it: "Pezzi", en: "Pieces" }, value: "3" },
    ],
  },
  {
    code: "ELC-03", cat: "electronics", brand: "voltplus",
    name: { it: "Power bank 20000mAh", en: "Power Bank 20000mAh" },
    short: { it: "Batteria portatile con ricarica rapida 22,5W", en: "Portable battery with 22.5W fast charge" },
    list: 16.0, retail: 34.9, stock: 90, weight_g: 420,
    features: f(["20000 mAh", "Ricarica rapida 22,5 W", "Doppia uscita"], ["20000 mAh", "22.5 W fast charge", "Dual output"]),
    specs: [
      { key: "capacity", label: { it: "Capacità", en: "Capacity" }, value: "20000", uom: "mAh" },
      { key: "output", label: { it: "Uscita", en: "Output" }, value: "22.5", uom: "W" },
    ],
  },
  {
    code: "ELC-04", cat: "electronics", brand: "voltplus",
    name: { it: "Mouse wireless", en: "Wireless Mouse" },
    short: { it: "Mouse silenzioso 2,4 GHz con ricevitore USB", en: "Silent 2.4 GHz mouse with USB receiver" },
    list: 5.5, retail: 12.9, stock: 230, weight_g: 110, pack_code: "BOX", pack_qty: 10,
    features: f(["Click silenzioso", "2,4 GHz", "1600 DPI"], ["Silent click", "2.4 GHz", "1600 DPI"]),
    specs: [
      { key: "dpi", label: { it: "Risoluzione", en: "Resolution" }, value: "1600", uom: "DPI" },
      { key: "conn", label: { it: "Connessione", en: "Connection" }, value: "2.4 GHz" },
    ],
  },
];

// ── Materialisation ─────────────────────────────────────────────────────────

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const VAT_RATE = 22;
const CURRENCY = "EUR";

/** Round to cents. */
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the full demo catalog as plain objects ready for `PIMProductModel.create()`.
 * `now` is injected so the provisioning/reset scripts control timestamps.
 */
export function buildDemoCatalog(now: Date = new Date()) {
  return TEMPLATES.map((t, idx) => {
    const cat = DEMO_CATEGORIES.find((c) => c.code === t.cat)!;
    const brand = DEMO_BRANDS.find((b) => b.code === t.brand)!;
    const entity_code = `DEMO-${t.code}`;
    const slug = { it: slugify(t.name.it), en: slugify(t.name.en) };

    // Default selling unit = single piece.
    const packaging_options: any[] = [
      {
        pkg_id: "1",
        code: "PZ",
        label: { it: "Pezzo", en: "Piece" },
        qty: 1,
        uom: "PZ",
        is_default: !t.pack_code,
        is_smallest: true,
        is_sellable: true,
        position: 0,
        pricing: { list: cents(t.list), retail: cents(t.retail), currency: CURRENCY, vat_included: false },
      },
    ];
    // Optional wholesale bulk packaging with a per-unit discount (B2B tiered pricing).
    if (t.pack_code && t.pack_qty) {
      const unitList = cents(t.list * 0.92); // -8% per unit when buying the bulk pack
      packaging_options.push({
        pkg_id: "2",
        code: t.pack_code,
        label: { it: `Confezione da ${t.pack_qty}`, en: `Pack of ${t.pack_qty}` },
        qty: t.pack_qty,
        uom: "PZ",
        is_default: true,
        is_smallest: false,
        is_sellable: true,
        position: 1,
        pricing: {
          list: cents(unitList * t.pack_qty),
          retail: cents(t.retail * t.pack_qty),
          list_unit: unitList,
          retail_unit: cents(t.retail),
          currency: CURRENCY,
          vat_included: false,
        },
      });
    }

    const tags = t.bestseller
      ? [
          {
            tag_id: "tag_bestseller",
            name: { it: "Più venduto", en: "Bestseller" },
            slug: "bestseller",
            color: "#e11d48",
            is_active: true,
          },
        ]
      : [];

    return {
      entity_code,
      sku: entity_code,
      channels: [...DEMO_CHANNELS],

      version: 1,
      isCurrent: true,
      isCurrentPublished: true,
      status: "published" as const,
      published_at: now,

      source: { ...DEMO_SOURCE, imported_at: now },

      completeness_score: 92,
      auto_publish_eligible: true,
      analytics: {
        views_30d: 0,
        clicks_30d: 0,
        add_to_cart_30d: 0,
        conversions_30d: 0,
        priority_score: t.bestseller ? 100 : 50 + (idx % 10),
        last_synced_at: now,
      },

      name: t.name,
      slug,
      short_description: t.short,
      description: {
        it: `${t.short.it}. ${t.features.it.join(" · ")}.`,
        en: `${t.short.en}. ${t.features.en.join(" · ")}.`,
      },

      images: [
        {
          url: `https://picsum.photos/seed/${entity_code}/800/800`,
          cdn_key: `demo/${entity_code}.jpg`,
          position: 0,
          uploaded_at: now,
          uploaded_by: "demo-seed",
        },
      ],

      quantity: t.stock,
      sold: 0,
      unit: "pcs",
      stock_status: "in_stock" as const,

      weight: t.weight_g,
      weight_uom: "G",

      brand: {
        brand_id: `br_${brand.code}`,
        label: brand.label,
        slug: brand.code,
        is_active: true,
      },
      category: {
        category_id: `cat_${cat.code}`,
        name: cat.name,
        slug: { it: cat.code, en: cat.code },
        is_active: true,
      },

      pricing: {
        list: cents(t.list),
        retail: cents(t.retail),
        currency: CURRENCY,
        vat_rate: VAT_RATE,
        vat_included: false,
      },

      packaging_options,

      marketing_features: { it: t.features.it, en: t.features.en },
      technical_specifications: {
        it: t.specs.map((s, i) => ({ key: s.key, label: s.label.it, value: s.value, uom: s.uom, order: i })),
        en: t.specs.map((s, i) => ({ key: s.key, label: s.label.en, value: s.value, uom: s.uom, order: i })),
      },

      tags,

      meta_title: { it: `${t.name.it} — ${brand.label}`, en: `${t.name.en} — ${brand.label}` },
      meta_description: t.short,
    };
  });
}

/** Convenience: total product count (for logs / tests). */
export const DEMO_CATALOG_SIZE = TEMPLATES.length;
