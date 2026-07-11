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
import { cdnUrlFor } from "./demo-images.js";
import { buildPiecePricing, buildPackPricing } from "./demo-pricing.js";

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
  // ── Utensili elettrici ────────────────────────────────────────────────────
  {
    code: "UEL-01", cat: "utensili-elettrici", brand: "forgia",
    name: { it: "Trapano avvitatore 18V", en: "18V Cordless Drill-Driver" },
    short: { it: "Trapano avvitatore a batteria 18V, coppia 45 Nm", en: "18V cordless drill-driver, 45 Nm torque" },
    list: 64.0, retail: 119.0, stock: 80, weight_g: 1650, pack_code: "BOX", pack_qty: 4,
    features: f(["Batteria 18V", "Coppia 45 Nm", "Mandrino 13 mm"], ["18V battery", "45 Nm torque", "13 mm chuck"]),
    specs: [
      { key: "voltage", label: { it: "Tensione", en: "Voltage" }, value: "18", uom: "V" },
      { key: "torque", label: { it: "Coppia", en: "Torque" }, value: "45", uom: "Nm" },
    ],
    bestseller: true,
  },
  {
    code: "UEL-02", cat: "utensili-elettrici", brand: "vortek",
    name: { it: "Smerigliatrice angolare 125mm", en: "Angle Grinder 125mm" },
    short: { it: "Smerigliatrice angolare 900W, disco 125 mm", en: "900W angle grinder, 125 mm disc" },
    list: 38.5, retail: 74.9, stock: 120, weight_g: 2100,
    features: f(["900 W", "Disco 125 mm", "Protezione antiribaltamento"], ["900 W", "125 mm disc", "Anti-kickback guard"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "900", uom: "W" },
      { key: "disc", label: { it: "Disco", en: "Disc" }, value: "125", uom: "mm" },
    ],
  },
  {
    code: "UEL-03", cat: "utensili-elettrici", brand: "forgia",
    name: { it: "Avvitatore a impulsi 18V", en: "18V Impact Driver" },
    short: { it: "Avvitatore a impulsi 18V, coppia 180 Nm", en: "18V impact driver, 180 Nm torque" },
    list: 72.0, retail: 139.0, stock: 60, weight_g: 1400,
    features: f(["Batteria 18V", "Coppia 180 Nm", "Testa compatta"], ["18V battery", "180 Nm torque", "Compact head"]),
    specs: [
      { key: "voltage", label: { it: "Tensione", en: "Voltage" }, value: "18", uom: "V" },
      { key: "torque", label: { it: "Coppia", en: "Torque" }, value: "180", uom: "Nm" },
    ],
    bestseller: true,
  },
  {
    code: "UEL-04", cat: "utensili-elettrici", brand: "vortek",
    name: { it: "Seghetto alternativo 750W", en: "Jigsaw 750W" },
    short: { it: "Seghetto alternativo 750W, corsa 26 mm", en: "750W jigsaw, 26 mm stroke" },
    list: 41.0, retail: 82.0, stock: 70, weight_g: 2300,
    features: f(["750 W", "Corsa 26 mm", "Tavola inclinabile"], ["750 W", "26 mm stroke", "Tilting base plate"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "750", uom: "W" },
      { key: "stroke", label: { it: "Corsa", en: "Stroke" }, value: "26", uom: "mm" },
    ],
  },
  {
    code: "UEL-05", cat: "utensili-elettrici", brand: "forgia",
    name: { it: "Trapano a percussione 850W", en: "Hammer Drill 850W" },
    short: { it: "Trapano a percussione 850W, mandrino 13 mm", en: "850W hammer drill, 13 mm chuck" },
    list: 33.0, retail: 66.0, stock: 110, weight_g: 2500,
    features: f(["850 W", "Mandrino 13 mm", "Funzione percussione"], ["850 W", "13 mm chuck", "Hammer function"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "850", uom: "W" },
      { key: "chuck", label: { it: "Mandrino", en: "Chuck" }, value: "13", uom: "mm" },
    ],
  },
  {
    code: "UEL-06", cat: "utensili-elettrici", brand: "vortek",
    name: { it: "Levigatrice orbitale 300W", en: "Orbital Sander 300W" },
    short: { it: "Levigatrice orbitale 300W, piastra 125 mm", en: "300W orbital sander, 125 mm pad" },
    list: 27.0, retail: 54.9, stock: 90, weight_g: 1500,
    features: f(["300 W", "Piastra 125 mm", "Sacchetto raccoglipolvere"], ["300 W", "125 mm pad", "Dust collection bag"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "300", uom: "W" },
      { key: "pad", label: { it: "Piastra", en: "Pad" }, value: "125", uom: "mm" },
    ],
  },
  {
    code: "UEL-07", cat: "utensili-elettrici", brand: "forgia",
    name: { it: "Sega circolare 1400W", en: "Circular Saw 1400W" },
    short: { it: "Sega circolare 1400W, lama 190 mm", en: "1400W circular saw, 190 mm blade" },
    list: 58.0, retail: 115.0, stock: 45, weight_g: 3600,
    features: f(["1400 W", "Lama 190 mm", "Guida parallela inclusa"], ["1400 W", "190 mm blade", "Parallel guide included"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "1400", uom: "W" },
      { key: "blade", label: { it: "Lama", en: "Blade" }, value: "190", uom: "mm" },
    ],
  },
  {
    code: "UEL-08", cat: "utensili-elettrici", brand: "vortek",
    name: { it: "Pistola termica 2000W", en: "Heat Gun 2000W" },
    short: { it: "Pistola termica 2000W, temperatura fino a 600 °C", en: "2000W heat gun, up to 600 °C" },
    list: 19.5, retail: 39.9, stock: 130, weight_g: 850, pack_code: "BOX", pack_qty: 6,
    features: f(["2000 W", "Fino a 600 °C", "2 velocità"], ["2000 W", "Up to 600 °C", "2 speed settings"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "2000", uom: "W" },
      { key: "temp", label: { it: "Temperatura", en: "Temperature" }, value: "600", uom: "°C" },
    ],
  },
  {
    code: "UEL-09", cat: "utensili-elettrici", brand: "forgia",
    name: { it: "Tassellatore SDS-Plus 800W", en: "SDS-Plus Rotary Hammer 800W" },
    short: { it: "Tassellatore SDS-Plus 800W, energia 2,8 J", en: "800W SDS-Plus rotary hammer, 2.8 J energy" },
    list: 79.0, retail: 149.0, stock: 40, weight_g: 2900,
    features: f(["800 W", "Energia 2,8 J", "SDS-Plus"], ["800 W", "2.8 J energy", "SDS-Plus"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "800", uom: "W" },
      { key: "energy", label: { it: "Energia", en: "Energy" }, value: "2.8", uom: "J" },
    ],
    bestseller: true,
  },
  {
    code: "UEL-10", cat: "utensili-elettrici", brand: "vortek",
    name: { it: "Avvitatore a batteria 12V", en: "12V Cordless Screwdriver" },
    short: { it: "Avvitatore a batteria compatto 12V, coppia 30 Nm", en: "Compact 12V cordless screwdriver, 30 Nm" },
    list: 29.0, retail: 58.0, stock: 150, weight_g: 700, pack_code: "BOX", pack_qty: 6,
    features: f(["12V", "Coppia 30 Nm", "Compatto e leggero"], ["12V", "30 Nm torque", "Compact and lightweight"]),
    specs: [
      { key: "voltage", label: { it: "Tensione", en: "Voltage" }, value: "12", uom: "V" },
      { key: "torque", label: { it: "Coppia", en: "Torque" }, value: "30", uom: "Nm" },
    ],
  },
  // ── Utensili a mano ───────────────────────────────────────────────────────
  {
    code: "UMA-01", cat: "utensili-mano", brand: "tenax",
    name: { it: "Set chiavi combinate 12 pz", en: "Combination Wrench Set 12 pc" },
    short: { it: "Set chiavi combinate Cr-V, 12 pezzi", en: "Cr-V combination wrench set, 12 pieces" },
    list: 22.0, retail: 44.9, stock: 150, weight_g: 1800, pack_code: "BOX", pack_qty: 6,
    features: f(["Acciaio Cr-V", "12 misure", "Finitura satinata"], ["Cr-V steel", "12 sizes", "Satin finish"]),
    specs: [
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Cr-V" },
      { key: "pieces", label: { it: "Pezzi", en: "Pieces" }, value: "12" },
    ],
    bestseller: true,
  },
  {
    code: "UMA-02", cat: "utensili-mano", brand: "tenax",
    name: { it: "Martello da carpentiere 500g", en: "Claw Hammer 500g" },
    short: { it: "Martello da carpentiere, testa 500g, manico in fibra di vetro", en: "Claw hammer, 500g head, fibreglass handle" },
    list: 6.8, retail: 14.5, stock: 240, weight_g: 620, pack_code: "BOX", pack_qty: 12,
    features: f(["Testa 500 g", "Manico in fibra di vetro", "Estrattore chiodi"], ["500 g head", "Fibreglass handle", "Nail puller"]),
    specs: [
      { key: "head_weight", label: { it: "Peso testa", en: "Head weight" }, value: "500", uom: "g" },
      { key: "handle", label: { it: "Manico", en: "Handle" }, value: "Fibreglass" },
    ],
  },
  {
    code: "UMA-03", cat: "utensili-mano", brand: "tenax",
    name: { it: "Set cacciaviti 6 pz", en: "Screwdriver Set 6 pc" },
    short: { it: "Set cacciaviti Cr-V, 6 pezzi, teste multiple", en: "Cr-V screwdriver set, 6 pieces, multiple tips" },
    list: 9.5, retail: 19.9, stock: 200, weight_g: 540, pack_code: "BOX", pack_qty: 10,
    features: f(["Acciaio Cr-V", "6 pezzi", "Impugnatura ergonomica"], ["Cr-V steel", "6 pieces", "Ergonomic grip"]),
    specs: [
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Cr-V" },
      { key: "pieces", label: { it: "Pezzi", en: "Pieces" }, value: "6" },
    ],
  },
  {
    code: "UMA-04", cat: "utensili-mano", brand: "granito",
    name: { it: "Pinza universale 180mm", en: "Combination Pliers 180mm" },
    short: { it: "Pinza universale 180mm in Cr-V", en: "180mm Cr-V combination pliers" },
    list: 7.2, retail: 15.5, stock: 220, weight_g: 320, pack_code: "BOX", pack_qty: 12,
    features: f(["Lunghezza 180 mm", "Acciaio Cr-V", "Manici bimateriale"], ["180 mm length", "Cr-V steel", "Bi-material handles"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "180", uom: "mm" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Cr-V" },
    ],
  },
  {
    code: "UMA-05", cat: "utensili-mano", brand: "tenax",
    name: { it: "Metro a nastro 5m", en: "Tape Measure 5m" },
    short: { it: "Metro a nastro 5m, nastro 25 mm", en: "5m tape measure, 25 mm blade" },
    list: 4.5, retail: 9.9, stock: 320, weight_g: 200, pack_code: "BOX", pack_qty: 24,
    features: f(["5 m", "Nastro 25 mm", "Blocco automatico"], ["5 m", "25 mm blade", "Auto-lock"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "5", uom: "m" },
      { key: "width", label: { it: "Larghezza nastro", en: "Blade width" }, value: "25", uom: "mm" },
    ],
    bestseller: true,
  },
  {
    code: "UMA-06", cat: "utensili-mano", brand: "granito",
    name: { it: "Livella a bolla 60cm", en: "Spirit Level 60cm" },
    short: { it: "Livella a bolla 60 cm, 3 fiale", en: "60 cm spirit level, 3 vials" },
    list: 11.0, retail: 22.9, stock: 130, weight_g: 480,
    features: f(["60 cm", "3 fiale", "Corpo in alluminio"], ["60 cm", "3 vials", "Aluminium body"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "60", uom: "cm" },
      { key: "vials", label: { it: "Fiale", en: "Vials" }, value: "3" },
    ],
  },
  {
    code: "UMA-07", cat: "utensili-mano", brand: "tenax",
    name: { it: "Set chiavi a brugola 9 pz", en: "Hex Key Set 9 pc" },
    short: { it: "Set chiavi a brugola 9 pz, 1,5–10 mm", en: "9-piece hex key set, 1.5–10 mm" },
    list: 5.0, retail: 10.9, stock: 280, weight_g: 220, pack_code: "BOX", pack_qty: 20,
    features: f(["9 misure", "1,5–10 mm", "Acciaio Cr-V"], ["9 sizes", "1.5–10 mm", "Cr-V steel"]),
    specs: [
      { key: "sizes", label: { it: "Misure", en: "Sizes" }, value: "1.5-10", uom: "mm" },
      { key: "pieces", label: { it: "Pezzi", en: "Pieces" }, value: "9" },
    ],
  },
  {
    code: "UMA-08", cat: "utensili-mano", brand: "granito",
    name: { it: "Sega a mano 500mm", en: "Hand Saw 500mm" },
    short: { it: "Sega a mano 500 mm, 8 TPI", en: "500 mm hand saw, 8 TPI" },
    list: 8.0, retail: 16.9, stock: 160, weight_g: 460,
    features: f(["500 mm", "8 TPI", "Impugnatura ergonomica"], ["500 mm", "8 TPI", "Ergonomic grip"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "500", uom: "mm" },
      { key: "tpi", label: { it: "Denti per pollice", en: "TPI" }, value: "8" },
    ],
  },
  {
    code: "UMA-09", cat: "utensili-mano", brand: "tenax",
    name: { it: "Cassetta portautensili 19\"", en: "Tool Box 19\"" },
    short: { it: "Cassetta portautensili 480 mm in polipropilene", en: "480 mm polypropylene tool box" },
    list: 14.5, retail: 29.9, stock: 95, weight_g: 1300,
    features: f(["480 mm", "Polipropilene", "Vassoio interno"], ["480 mm", "Polypropylene", "Inner tray"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "480", uom: "mm" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "PP" },
    ],
    bestseller: true,
  },
  {
    code: "UMA-10", cat: "utensili-mano", brand: "granito",
    name: { it: "Cutter professionale 18mm", en: "Utility Knife 18mm" },
    short: { it: "Cutter professionale 18 mm, corpo in alluminio", en: "Professional 18 mm utility knife, aluminium body" },
    list: 3.5, retail: 7.9, stock: 360, weight_g: 140, pack_code: "BOX", pack_qty: 24,
    features: f(["Lama 18 mm", "Corpo in alluminio", "Blocco automatico"], ["18 mm blade", "Aluminium body", "Auto-lock"]),
    specs: [
      { key: "blade", label: { it: "Lama", en: "Blade" }, value: "18", uom: "mm" },
      { key: "body", label: { it: "Corpo", en: "Body" }, value: "Aluminium" },
    ],
  },
  // ── Viteria & fissaggi ────────────────────────────────────────────────────
  {
    code: "FIS-01", cat: "fissaggi", brand: "granito",
    name: { it: "Viti autofilettanti 4×40 (BOX 500)", en: "Self-tapping Screws 4×40 (BOX 500)" },
    short: { it: "Viti zincate testa svasata, confezione da 500", en: "Zinc countersunk screws, box of 500" },
    list: 9.5, retail: 18.9, stock: 600, weight_g: 1500, pack_code: "BOX", pack_qty: 500,
    features: f(["Zincate", "Testa svasata", "4×40 mm"], ["Zinc plated", "Countersunk", "4×40 mm"]),
    specs: [
      { key: "dim", label: { it: "Dimensioni", en: "Dimensions" }, value: "4×40", uom: "mm" },
      { key: "finish", label: { it: "Finitura", en: "Finish" }, value: "Zinc" },
    ],
    bestseller: true,
  },
  {
    code: "FIS-02", cat: "fissaggi", brand: "granito",
    name: { it: "Tasselli a espansione 8mm (BOX 100)", en: "Expansion Plugs 8mm (BOX 100)" },
    short: { it: "Tasselli a espansione in nylon 8 mm, conf. 100", en: "Nylon expansion plugs 8 mm, box of 100" },
    list: 4.2, retail: 9.5, stock: 800, weight_g: 900, pack_code: "BOX", pack_qty: 100,
    features: f(["Diametro 8 mm", "Nylon resistente", "Confezione 100 pz"], ["8 mm diameter", "Resistant nylon", "Box of 100"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "8", uom: "mm" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Nylon" },
    ],
  },
  {
    code: "FIS-03", cat: "fissaggi", brand: "granito",
    name: { it: "Viti legno 5×60 (BOX 200)", en: "Wood Screws 5×60 (BOX 200)" },
    short: { it: "Viti per legno testa Pozidriv, conf. 200", en: "Pozidriv head wood screws, box of 200" },
    list: 7.8, retail: 15.9, stock: 500, weight_g: 1700, pack_code: "BOX", pack_qty: 200,
    features: f(["5×60 mm", "Testa Pozidriv", "Confezione 200 pz"], ["5×60 mm", "Pozidriv head", "Box of 200"]),
    specs: [
      { key: "dim", label: { it: "Dimensioni", en: "Dimensions" }, value: "5×60", uom: "mm" },
      { key: "head", label: { it: "Testa", en: "Head" }, value: "Pozidriv" },
    ],
    bestseller: true,
  },
  {
    code: "FIS-04", cat: "fissaggi", brand: "granito",
    name: { it: "Bulloni esagonali M8×40 (BOX 100)", en: "Hex Bolts M8×40 (BOX 100)" },
    short: { it: "Bulloni esagonali M8×40 classe 8.8, conf. 100", en: "M8×40 hex bolts grade 8.8, box of 100" },
    list: 11.0, retail: 21.9, stock: 400, weight_g: 2100, pack_code: "BOX", pack_qty: 100,
    features: f(["M8×40 mm", "Classe 8.8", "Confezione 100 pz"], ["M8×40 mm", "Grade 8.8", "Box of 100"]),
    specs: [
      { key: "thread", label: { it: "Filetto", en: "Thread" }, value: "M8" },
      { key: "grade", label: { it: "Classe", en: "Grade" }, value: "8.8" },
    ],
  },
  {
    code: "FIS-05", cat: "fissaggi", brand: "granito",
    name: { it: "Rondelle piane M8 (BOX 500)", en: "Flat Washers M8 (BOX 500)" },
    short: { it: "Rondelle piane M8 zincate, confezione da 500", en: "M8 zinc flat washers, box of 500" },
    list: 3.0, retail: 6.5, stock: 900, weight_g: 700, pack_code: "BOX", pack_qty: 500,
    features: f(["M8", "Zincate", "Confezione 500 pz"], ["M8", "Zinc plated", "Box of 500"]),
    specs: [
      { key: "size", label: { it: "Misura", en: "Size" }, value: "M8" },
      { key: "finish", label: { it: "Finitura", en: "Finish" }, value: "Zinc" },
    ],
  },
  {
    code: "FIS-06", cat: "fissaggi", brand: "granito",
    name: { it: "Dadi esagonali M8 (BOX 500)", en: "Hex Nuts M8 (BOX 500)" },
    short: { it: "Dadi esagonali M8 classe 8, confezione da 500", en: "M8 hex nuts grade 8, box of 500" },
    list: 4.5, retail: 9.5, stock: 850, weight_g: 900, pack_code: "BOX", pack_qty: 500,
    features: f(["M8", "Classe 8", "Confezione 500 pz"], ["M8", "Grade 8", "Box of 500"]),
    specs: [
      { key: "thread", label: { it: "Filetto", en: "Thread" }, value: "M8" },
      { key: "grade", label: { it: "Classe", en: "Grade" }, value: "8" },
    ],
  },
  {
    code: "FIS-07", cat: "fissaggi", brand: "granito",
    name: { it: "Tasselli chimici 300ml", en: "Chemical Anchor 300ml" },
    short: { it: "Tassello chimico vinilesteri 300ml", en: "300ml vinylester chemical anchor" },
    list: 8.0, retail: 16.9, stock: 180, weight_g: 450, pack_code: "BOX", pack_qty: 12,
    features: f(["Vinilesteri", "300 ml", "Alta resistenza"], ["Vinylester", "300 ml", "High strength"]),
    specs: [
      { key: "volume", label: { it: "Volume", en: "Volume" }, value: "300", uom: "ml" },
      { key: "type", label: { it: "Tipo", en: "Type" }, value: "Vinylester" },
    ],
  },
  {
    code: "FIS-08", cat: "fissaggi", brand: "granito",
    name: { it: "Fascette nylon 200mm (BOX 100)", en: "Cable Ties 200mm (BOX 100)" },
    short: { it: "Fascette fermacavi in nylon 200mm, conf. 100", en: "Nylon cable ties 200mm, box of 100" },
    list: 2.5, retail: 5.9, stock: 700, weight_g: 300, pack_code: "BOX", pack_qty: 100,
    features: f(["200 mm", "Nylon resistente", "Confezione 100 pz"], ["200 mm", "Resistant nylon", "Box of 100"]),
    specs: [
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "200", uom: "mm" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Nylon" },
    ],
    bestseller: true,
  },
  {
    code: "FIS-09", cat: "fissaggi", brand: "granito",
    name: { it: "Ancoranti per cartongesso (BOX 50)", en: "Plasterboard Anchors (BOX 50)" },
    short: { it: "Ancoranti metallici per cartongesso, conf. 50", en: "Metal plasterboard anchors, box of 50" },
    list: 5.5, retail: 11.9, stock: 420, weight_g: 600, pack_code: "BOX", pack_qty: 50,
    features: f(["Metallo", "25 kg carico", "Confezione 50 pz"], ["Metal", "25 kg load", "Box of 50"]),
    specs: [
      { key: "load", label: { it: "Carico", en: "Load" }, value: "25", uom: "kg" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Metal" },
    ],
  },
  {
    code: "FIS-10", cat: "fissaggi", brand: "granito",
    name: { it: "Viti truciolare 4×30 (BOX 1000)", en: "Chipboard Screws 4×30 (BOX 1000)" },
    short: { it: "Viti per truciolare testa svasata, conf. 1000", en: "Countersunk chipboard screws, box of 1000" },
    list: 12.0, retail: 23.9, stock: 350, weight_g: 2400, pack_code: "BOX", pack_qty: 1000,
    features: f(["4×30 mm", "Testa svasata", "Confezione 1000 pz"], ["4×30 mm", "Countersunk head", "Box of 1000"]),
    specs: [
      { key: "dim", label: { it: "Dimensioni", en: "Dimensions" }, value: "4×30", uom: "mm" },
      { key: "head", label: { it: "Testa", en: "Head" }, value: "Countersunk" },
    ],
  },
  // ── Abrasivi ──────────────────────────────────────────────────────────────
  {
    code: "ABR-01", cat: "abrasivi", brand: "vortek",
    name: { it: "Dischi da taglio inox 125mm (10 pz)", en: "Inox Cutting Discs 125mm (10 pc)" },
    short: { it: "Dischi da taglio per inox 125mm, conf. 10", en: "Inox cutting discs 125mm, pack of 10" },
    list: 7.0, retail: 15.9, stock: 320, weight_g: 700, pack_code: "BOX", pack_qty: 10,
    features: f(["125 mm", "Spessore 1 mm", "Per inox"], ["125 mm", "1 mm thick", "For inox"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "125", uom: "mm" },
      { key: "thick", label: { it: "Spessore", en: "Thickness" }, value: "1", uom: "mm" },
    ],
    bestseller: true,
  },
  {
    code: "ABR-02", cat: "abrasivi", brand: "vortek",
    name: { it: "Dischi lamellari 125mm (5 pz)", en: "Flap Discs 125mm (5 pc)" },
    short: { it: "Dischi lamellari 125mm grana P60, conf. 5", en: "125mm flap discs P60 grit, pack of 5" },
    list: 9.5, retail: 19.9, stock: 240, weight_g: 650, pack_code: "BOX", pack_qty: 5,
    features: f(["125 mm", "Grana P60", "Confezione 5 pz"], ["125 mm", "P60 grit", "Pack of 5"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "125", uom: "mm" },
      { key: "grit", label: { it: "Grana", en: "Grit" }, value: "P60" },
    ],
  },
  {
    code: "ABR-03", cat: "abrasivi", brand: "scudo",
    name: { it: "Carta abrasiva P120 (25 fogli)", en: "Sandpaper P120 (25 sheets)" },
    short: { it: "Carta abrasiva grana P120, 25 fogli 230×280 mm", en: "P120 grit sandpaper, 25 sheets 230×280 mm" },
    list: 6.0, retail: 12.9, stock: 300, weight_g: 800, pack_code: "BOX", pack_qty: 25,
    features: f(["Grana P120", "25 fogli", "230×280 mm"], ["P120 grit", "25 sheets", "230×280 mm"]),
    specs: [
      { key: "grit", label: { it: "Grana", en: "Grit" }, value: "P120" },
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "230×280", uom: "mm" },
    ],
  },
  {
    code: "ABR-04", cat: "abrasivi", brand: "vortek",
    name: { it: "Dischi da sbavo 125mm (10 pz)", en: "Grinding Discs 125mm (10 pc)" },
    short: { it: "Dischi da sbavo 125mm spessore 6mm, conf. 10", en: "125mm grinding discs 6mm thick, pack of 10" },
    list: 8.5, retail: 17.9, stock: 260, weight_g: 1200, pack_code: "BOX", pack_qty: 10,
    features: f(["125 mm", "Spessore 6 mm", "Per acciaio"], ["125 mm", "6 mm thick", "For steel"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "125", uom: "mm" },
      { key: "thick", label: { it: "Spessore", en: "Thickness" }, value: "6", uom: "mm" },
    ],
  },
  {
    code: "ABR-05", cat: "abrasivi", brand: "scudo",
    name: { it: "Spazzola metallica a tazza 75mm", en: "Wire Cup Brush 75mm" },
    short: { it: "Spazzola a tazza in acciaio 75mm per smerigliatrice", en: "75mm steel wire cup brush for grinder" },
    list: 5.5, retail: 11.9, stock: 180, weight_g: 280,
    features: f(["75 mm", "Filo in acciaio", "Per smerigliatrice"], ["75 mm", "Steel wire", "For grinder"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "75", uom: "mm" },
      { key: "wire", label: { it: "Filo", en: "Wire" }, value: "Steel" },
    ],
  },
  {
    code: "ABR-06", cat: "abrasivi", brand: "vortek",
    name: { it: "Rotoli abrasivi P80 (5m)", en: "Abrasive Roll P80 (5m)" },
    short: { it: "Rotolo abrasivo grana P80, 5 m", en: "P80 grit abrasive roll, 5 m" },
    list: 7.5, retail: 15.5, stock: 150, weight_g: 600,
    features: f(["Grana P80", "5 m", "Adatto a più superfici"], ["P80 grit", "5 m", "Multi-surface"]),
    specs: [
      { key: "grit", label: { it: "Grana", en: "Grit" }, value: "P80" },
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "5", uom: "m" },
    ],
  },
  {
    code: "ABR-07", cat: "abrasivi", brand: "scudo",
    name: { it: "Dischi velcrati P180 (50 pz)", en: "Hook-Loop Discs P180 (50 pc)" },
    short: { it: "Dischi velcrati P180 diam. 150mm, conf. 50", en: "P180 hook-and-loop discs 150mm dia., pack of 50" },
    list: 11.0, retail: 22.9, stock: 200, weight_g: 500, pack_code: "BOX", pack_qty: 50,
    features: f(["Grana P180", "150 mm", "Confezione 50 pz"], ["P180 grit", "150 mm", "Pack of 50"]),
    specs: [
      { key: "grit", label: { it: "Grana", en: "Grit" }, value: "P180" },
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "150", uom: "mm" },
    ],
    bestseller: true,
  },
  {
    code: "ABR-08", cat: "abrasivi", brand: "vortek",
    name: { it: "Mola da banco 200mm", en: "Bench Grinding Wheel 200mm" },
    short: { it: "Mola da banco 200mm grana media", en: "200mm bench grinding wheel, medium grit" },
    list: 9.0, retail: 18.9, stock: 90, weight_g: 1400,
    features: f(["200 mm", "Grana media", "Per smerigliatrice da banco"], ["200 mm", "Medium grit", "For bench grinder"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "200", uom: "mm" },
      { key: "grit", label: { it: "Grana", en: "Grit" }, value: "Medium" },
    ],
  },
  {
    code: "ABR-09", cat: "abrasivi", brand: "scudo",
    name: { it: "Tamponi diamantati 100mm", en: "Diamond Pads 100mm" },
    short: { it: "Tamponi diamantati 100mm grana P200", en: "100mm diamond pads, P200 grit" },
    list: 13.0, retail: 26.9, stock: 110, weight_g: 350,
    features: f(["100 mm", "Grana P200", "Per levigatura a umido"], ["100 mm", "P200 grit", "For wet grinding"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "100", uom: "mm" },
      { key: "grit", label: { it: "Grana", en: "Grit" }, value: "P200" },
    ],
  },
  {
    code: "ABR-10", cat: "abrasivi", brand: "vortek",
    name: { it: "Spugne abrasive (10 pz)", en: "Sanding Sponges (10 pc)" },
    short: { it: "Spugne abrasive grana Fine, conf. 10", en: "Fine grit sanding sponges, pack of 10" },
    list: 4.0, retail: 8.9, stock: 280, weight_g: 400, pack_code: "BOX", pack_qty: 10,
    features: f(["Grana Fine", "100×70 mm", "Lavabili e riutilizzabili"], ["Fine grit", "100×70 mm", "Washable and reusable"]),
    specs: [
      { key: "grit", label: { it: "Grana", en: "Grit" }, value: "Fine" },
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "100×70", uom: "mm" },
    ],
  },
  // ── Materiale elettrico ───────────────────────────────────────────────────
  {
    code: "ELE-01", cat: "elettrico", brand: "elettron",
    name: { it: "Cavo unipolare 2.5mm² (100m)", en: "Single-core Cable 2.5mm² (100m)" },
    short: { it: "Cavo unipolare 2,5 mm², rotolo 100 m", en: "2.5 mm² single-core cable, 100 m reel" },
    list: 28.0, retail: 49.0, stock: 90, weight_g: 3200,
    features: f(["2,5 mm²", "100 m", "Conforme CEI"], ["2.5 mm²", "100 m", "CEI compliant"]),
    specs: [
      { key: "section", label: { it: "Sezione", en: "Section" }, value: "2.5", uom: "mm²" },
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "100", uom: "m" },
    ],
  },
  {
    code: "ELE-02", cat: "elettrico", brand: "elettron",
    name: { it: "Interruttore magnetotermico 16A", en: "MCB 16A" },
    short: { it: "Interruttore magnetotermico 16A, 1P+N", en: "16A MCB, 1P+N" },
    list: 6.5, retail: 13.9, stock: 200, weight_g: 160, pack_code: "BOX", pack_qty: 10,
    features: f(["16A", "1P+N", "Montaggio su guida DIN"], ["16A", "1P+N", "DIN rail mount"]),
    specs: [
      { key: "current", label: { it: "Corrente", en: "Current" }, value: "16", uom: "A" },
      { key: "poles", label: { it: "Poli", en: "Poles" }, value: "1P+N" },
    ],
    bestseller: true,
  },
  {
    code: "ELE-03", cat: "elettrico", brand: "elettron",
    name: { it: "Presa Schuko 16A bianca", en: "Schuko Socket 16A White" },
    short: { it: "Presa Schuko 16A incasso colore bianco", en: "16A white flush-mount Schuko socket" },
    list: 3.2, retail: 7.5, stock: 350, weight_g: 120, pack_code: "BOX", pack_qty: 20,
    features: f(["16A", "Incasso", "Colore bianco"], ["16A", "Flush mount", "White colour"]),
    specs: [
      { key: "current", label: { it: "Corrente", en: "Current" }, value: "16", uom: "A" },
      { key: "colour", label: { it: "Colore", en: "Colour" }, value: "White" },
    ],
  },
  {
    code: "ELE-04", cat: "elettrico", brand: "elettron",
    name: { it: "Scatola derivazione 100×100", en: "Junction Box 100×100" },
    short: { it: "Scatola di derivazione 100×100 mm, IP55", en: "100×100 mm junction box, IP55" },
    list: 2.8, retail: 6.5, stock: 280, weight_g: 180, pack_code: "BOX", pack_qty: 24,
    features: f(["100×100 mm", "IP55", "Passaggi cavi laterali"], ["100×100 mm", "IP55", "Side cable entries"]),
    specs: [
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "100×100", uom: "mm" },
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "IP55" },
    ],
  },
  {
    code: "ELE-05", cat: "elettrico", brand: "elettron",
    name: { it: "Quadro elettrico 12 moduli", en: "Distribution Board 12 modules" },
    short: { it: "Quadro elettrico da incasso, 12 moduli, IP40", en: "Flush-mount distribution board, 12 modules, IP40" },
    list: 14.0, retail: 28.9, stock: 70, weight_g: 900,
    features: f(["12 moduli", "IP40", "Incasso"], ["12 modules", "IP40", "Flush mount"]),
    specs: [
      { key: "modules", label: { it: "Moduli", en: "Modules" }, value: "12" },
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "IP40" },
    ],
  },
  {
    code: "ELE-06", cat: "elettrico", brand: "elettron",
    name: { it: "Faretto LED 30W IP65", en: "LED Floodlight 30W IP65" },
    short: { it: "Faretto LED 30W IP65 per esterno", en: "30W IP65 LED floodlight for outdoor use" },
    list: 12.5, retail: 25.9, stock: 130, weight_g: 650, pack_code: "BOX", pack_qty: 6,
    features: f(["30 W", "IP65", "Per esterno"], ["30 W", "IP65", "Outdoor use"]),
    specs: [
      { key: "power", label: { it: "Potenza", en: "Power" }, value: "30", uom: "W" },
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "IP65" },
    ],
    bestseller: true,
  },
  {
    code: "ELE-07", cat: "elettrico", brand: "elettron",
    name: { it: "Canalina passacavi 20×10 (2m)", en: "Cable Trunking 20×10 (2m)" },
    short: { it: "Canalina passacavi 20×10 mm, 2 m", en: "20×10 mm cable trunking, 2 m" },
    list: 1.9, retail: 4.5, stock: 400, weight_g: 240, pack_code: "BOX", pack_qty: 20,
    features: f(["20×10 mm", "2 m", "Autoadesiva"], ["20×10 mm", "2 m", "Self-adhesive"]),
    specs: [
      { key: "size", label: { it: "Dimensioni", en: "Size" }, value: "20×10", uom: "mm" },
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "2", uom: "m" },
    ],
  },
  {
    code: "ELE-08", cat: "elettrico", brand: "elettron",
    name: { it: "Morsetti rapidi 3 vie (50 pz)", en: "Lever Connectors 3-way (50 pc)" },
    short: { it: "Morsetti rapidi a leva 3 vie, conf. 50", en: "3-way lever connectors, pack of 50" },
    list: 9.0, retail: 18.9, stock: 180, weight_g: 350, pack_code: "BOX", pack_qty: 50,
    features: f(["3 vie", "32A", "Confezione 50 pz"], ["3-way", "32A", "Pack of 50"]),
    specs: [
      { key: "ways", label: { it: "Vie", en: "Ways" }, value: "3" },
      { key: "current", label: { it: "Corrente", en: "Current" }, value: "32", uom: "A" },
    ],
  },
  {
    code: "ELE-09", cat: "elettrico", brand: "elettron",
    name: { it: "Tubo corrugato 25mm (50m)", en: "Corrugated Conduit 25mm (50m)" },
    short: { it: "Tubo corrugato flessibile 25mm, rotolo 50m", en: "25mm flexible corrugated conduit, 50m reel" },
    list: 11.0, retail: 21.9, stock: 95, weight_g: 1800,
    features: f(["25 mm", "50 m", "Autoestinguente"], ["25 mm", "50 m", "Self-extinguishing"]),
    specs: [
      { key: "dia", label: { it: "Diametro", en: "Diameter" }, value: "25", uom: "mm" },
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "50", uom: "m" },
    ],
  },
  {
    code: "ELE-10", cat: "elettrico", brand: "elettron",
    name: { it: "Nastro isolante (10 pz)", en: "Insulation Tape (10 pc)" },
    short: { it: "Nastro isolante 19mm×20m, confezione 10 pz", en: "19mm×20m insulation tape, pack of 10" },
    list: 4.5, retail: 9.9, stock: 320, weight_g: 300, pack_code: "BOX", pack_qty: 10,
    features: f(["19 mm", "20 m", "Confezione 10 pz"], ["19 mm", "20 m", "Pack of 10"]),
    specs: [
      { key: "width", label: { it: "Larghezza", en: "Width" }, value: "19", uom: "mm" },
      { key: "length", label: { it: "Lunghezza", en: "Length" }, value: "20", uom: "m" },
    ],
  },
  // ── DPI ───────────────────────────────────────────────────────────────────
  {
    code: "DPI-01", cat: "dpi", brand: "scudo",
    name: { it: "Guanti antitaglio livello 5 (12 paia)", en: "Cut-resistant Gloves Level 5 (12 pairs)" },
    short: { it: "Guanti antitaglio livello 5 in HPPE, 12 paia", en: "Level 5 HPPE cut-resistant gloves, 12 pairs" },
    list: 11.0, retail: 22.9, stock: 260, weight_g: 720, pack_code: "BOX", pack_qty: 12,
    features: f(["Livello taglio 5", "HPPE", "12 paia"], ["Cut level 5", "HPPE", "12 pairs"]),
    specs: [
      { key: "cut_level", label: { it: "Livello taglio", en: "Cut level" }, value: "5" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "HPPE" },
    ],
    bestseller: true,
  },
  {
    code: "DPI-02", cat: "dpi", brand: "scudo",
    name: { it: "Occhiali di protezione trasparenti", en: "Safety Glasses Clear" },
    short: { it: "Occhiali di protezione in policarbonato, EN166", en: "Polycarbonate safety glasses, EN166" },
    list: 2.5, retail: 5.9, stock: 400, weight_g: 60, pack_code: "BOX", pack_qty: 20,
    features: f(["Policarbonato", "EN166", "Antigraffio"], ["Polycarbonate", "EN166", "Scratch-resistant"]),
    specs: [
      { key: "lens", label: { it: "Lente", en: "Lens" }, value: "Polycarbonate" },
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "EN166" },
    ],
  },
  {
    code: "DPI-03", cat: "dpi", brand: "scudo",
    name: { it: "Mascherine FFP2 (20 pz)", en: "FFP2 Masks (20 pc)" },
    short: { it: "Mascherine FFP2 senza valvola, conf. 20", en: "FFP2 masks without valve, pack of 20" },
    list: 8.0, retail: 16.9, stock: 300, weight_g: 200, pack_code: "BOX", pack_qty: 20,
    features: f(["FFP2", "Senza valvola", "Confezione 20 pz"], ["FFP2", "Without valve", "Pack of 20"]),
    specs: [
      { key: "class", label: { it: "Classe", en: "Class" }, value: "FFP2" },
      { key: "valve", label: { it: "Valvola", en: "Valve" }, value: "No" },
    ],
    bestseller: true,
  },
  {
    code: "DPI-04", cat: "dpi", brand: "scudo",
    name: { it: "Casco da cantiere bianco", en: "Hard Hat White" },
    short: { it: "Casco da cantiere bianco EN397", en: "White hard hat EN397" },
    list: 6.5, retail: 13.9, stock: 180, weight_g: 380,
    features: f(["EN397", "Colore bianco", "Regolazione interna"], ["EN397", "White colour", "Internal adjustment"]),
    specs: [
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "EN397" },
      { key: "colour", label: { it: "Colore", en: "Colour" }, value: "White" },
    ],
  },
  {
    code: "DPI-05", cat: "dpi", brand: "scudo",
    name: { it: "Scarpe antinfortunistiche S3 42", en: "Safety Shoes S3 Size 42" },
    short: { it: "Scarpe antinfortunistiche classe S3, taglia 42", en: "S3 class safety shoes, size 42" },
    list: 32.0, retail: 64.9, stock: 90, weight_g: 1200,
    features: f(["Classe S3", "Puntale in acciaio", "Taglia 42"], ["Class S3", "Steel toe cap", "Size 42"]),
    specs: [
      { key: "class", label: { it: "Classe", en: "Class" }, value: "S3" },
      { key: "toe", label: { it: "Puntale", en: "Toe" }, value: "Steel" },
    ],
    bestseller: true,
  },
  {
    code: "DPI-06", cat: "dpi", brand: "scudo",
    name: { it: "Cuffie antirumore 27dB", en: "Ear Defenders 27dB" },
    short: { it: "Cuffie antirumore SNR 27dB, EN352", en: "SNR 27dB ear defenders, EN352" },
    list: 7.5, retail: 15.9, stock: 150, weight_g: 280,
    features: f(["SNR 27 dB", "EN352", "Archetto regolabile"], ["SNR 27 dB", "EN352", "Adjustable headband"]),
    specs: [
      { key: "snr", label: { it: "SNR", en: "SNR" }, value: "27", uom: "dB" },
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "EN352" },
    ],
  },
  {
    code: "DPI-07", cat: "dpi", brand: "scudo",
    name: { it: "Tuta da lavoro taglia L", en: "Work Coverall Size L" },
    short: { it: "Tuta da lavoro in policotone, taglia L", en: "Polycotton work coverall, size L" },
    list: 18.0, retail: 36.9, stock: 110, weight_g: 850,
    features: f(["Taglia L", "Policotone", "Tasche multiple"], ["Size L", "Polycotton", "Multiple pockets"]),
    specs: [
      { key: "size", label: { it: "Taglia", en: "Size" }, value: "L" },
      { key: "fabric", label: { it: "Tessuto", en: "Fabric" }, value: "Polycotton" },
    ],
  },
  {
    code: "DPI-08", cat: "dpi", brand: "scudo",
    name: { it: "Ginocchiere professionali", en: "Knee Pads Professional" },
    short: { it: "Ginocchiere professionali gel EN14404", en: "Professional gel knee pads EN14404" },
    list: 9.0, retail: 18.9, stock: 140, weight_g: 420,
    features: f(["Gel", "EN14404", "Chiusura regolabile"], ["Gel", "EN14404", "Adjustable strap"]),
    specs: [
      { key: "type", label: { it: "Tipo", en: "Type" }, value: "Gel" },
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "EN14404" },
    ],
  },
  {
    code: "DPI-09", cat: "dpi", brand: "scudo",
    name: { it: "Imbracatura anticaduta", en: "Fall Arrest Harness" },
    short: { it: "Imbracatura anticaduta a 2 punti EN361", en: "2-point fall arrest harness EN361" },
    list: 28.0, retail: 56.9, stock: 60, weight_g: 1100,
    features: f(["2 punti", "EN361", "Regolazione universale"], ["2 points", "EN361", "Universal adjustment"]),
    specs: [
      { key: "points", label: { it: "Punti", en: "Points" }, value: "2" },
      { key: "rating", label: { it: "Grado", en: "Rating" }, value: "EN361" },
    ],
  },
  {
    code: "DPI-10", cat: "dpi", brand: "scudo",
    name: { it: "Guanti nitrile monouso (100 pz)", en: "Nitrile Disposable Gloves (100 pc)" },
    short: { it: "Guanti monouso in nitrile taglia M, conf. 100", en: "Nitrile disposable gloves size M, pack of 100" },
    list: 5.0, retail: 10.9, stock: 350, weight_g: 600, pack_code: "BOX", pack_qty: 100,
    features: f(["Nitrile", "Taglia M", "Confezione 100 pz"], ["Nitrile", "Size M", "Pack of 100"]),
    specs: [
      { key: "size", label: { it: "Taglia", en: "Size" }, value: "M" },
      { key: "material", label: { it: "Materiale", en: "Material" }, value: "Nitrile" },
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

    // Single-piece options: one per persona (tag-filtered). Exactly ONE is
    // is_default:true in the raw doc — the standard tier (fix H). When the
    // SKU has a bulk pack, the piece tier never wins (the bulk tier is the
    // group default), so single-piece is_default stays false in that case.
    const pieceTiers = buildPiecePricing(t.list, t.retail);
    const packaging_options: any[] = pieceTiers.map((tier, i) => ({
      pkg_id: `pz-${tier.persona}`,
      code: "PZ",
      label: { it: "Pezzo", en: "Piece" },
      qty: 1,
      uom: "PZ",
      is_default: !t.pack_code && tier.is_canonical_default,
      is_smallest: true,
      is_sellable: true,
      position: i,
      pricing: {
        list: tier.list, retail: tier.retail,
        currency: tier.currency, vat_included: tier.vat_included, tag_filter: tier.tag_filter,
      },
    }));

    // Optional bulk pack: one option per persona (tag-filtered, −8%/unit).
    // Exactly ONE is is_default:true — the standard tier (fix H).
    if (t.pack_code && t.pack_qty) {
      const packTiers = buildPackPricing(t.list, t.pack_qty, t.retail);
      packTiers.forEach((tier, i) => {
        packaging_options.push({
          pkg_id: `pack-${tier.persona}`,
          code: t.pack_code!,
          label: { it: `Confezione da ${t.pack_qty}`, en: `Pack of ${t.pack_qty}` },
          qty: t.pack_qty,
          uom: "PZ",
          is_default: tier.is_canonical_default,
          is_smallest: false,
          is_sellable: true,
          position: 10 + i,
          pricing: {
            list: tier.list, retail: tier.retail,
            list_unit: tier.list_unit, retail_unit: tier.retail_unit,
            currency: tier.currency, vat_included: tier.vat_included, tag_filter: tier.tag_filter,
          },
        });
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
          url: cdnUrlFor(t.code),
          cdn_key: `demo/${entity_code}.jpg`, // === demo/DEMO-<code>.jpg
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
