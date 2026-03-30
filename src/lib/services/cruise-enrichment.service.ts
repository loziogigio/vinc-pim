/**
 * Cruise enrichment service.
 *
 * Joins OC flat cruise data with PIM product data (ship images, descriptions,
 * YouTube videos, star ratings, cabin images/descriptions) before returning
 * to OCB. OCB stays single-source — all enrichment happens here.
 */

import { connectWithModels } from "@/lib/db/connection";

const CRUISE_TENANT_DB = process.env.CRUISE_TENANT_DB || "vinc-offerte-crociere-it";

// ─── Company short_name → PIM prefix mapping ────────────────

const COMPANY_PREFIX: Record<string, string> = {
  msc: "msc",
  costa: "costa",
  ncl: "ncl",
  celebrity: "cel",
  azamara: "aza",
  rci: "rcg",
};

function shipEntityCode(companyShortName: string, shipCode: string): string {
  const prefix = COMPANY_PREFIX[companyShortName.toLowerCase()] || companyShortName.toLowerCase();
  return `ship-${prefix}-${shipCode.toLowerCase()}`;
}

// ─── PIM data shape returned to OCB ─────────────────────────

interface PIMShipData {
  description?: Record<string, string>;
  images: { url: string; cdn_key: string; position: number }[];
  media: { type: string; url: string; label: Record<string, string>; is_external_link?: boolean }[];
  attributes?: Record<string, { key: string; label: string; value: any }[]>;
}

interface PIMCabinData {
  description?: Record<string, string>;
  images: { url: string; cdn_key: string; position: number }[];
}

// ─── Ship cache (avoids repeated DB queries within a request) ─

const shipCache = new Map<string, PIMShipData | null>();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

function clearCacheIfStale() {
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS) {
    shipCache.clear();
    cacheTimestamp = Date.now();
  }
}

// ─── Core lookup ─────────────────────────────────────────────

async function lookupShip(entityCode: string): Promise<PIMShipData | null> {
  clearCacheIfStale();
  if (shipCache.has(entityCode)) return shipCache.get(entityCode)!;

  try {
    const { PIMProduct } = await connectWithModels(CRUISE_TENANT_DB);
    const product = await PIMProduct.findOne(
      { entity_code: entityCode, isCurrent: true },
      { description: 1, images: 1, media: 1, attributes: 1 },
    ).lean();

    if (!product) {
      shipCache.set(entityCode, null);
      return null;
    }

    const data: PIMShipData = {
      description: product.description as Record<string, string> | undefined,
      images: ((product.images as any[]) || []).map((img) => ({
        url: img.url,
        cdn_key: img.cdn_key,
        position: img.position ?? 0,
      })),
      media: ((product.media as any[]) || []).map((m) => ({
        type: m.type,
        url: m.url,
        label: m.label || {},
        is_external_link: m.is_external_link,
      })),
      attributes: product.attributes as PIMShipData["attributes"],
    };

    shipCache.set(entityCode, data);
    return data;
  } catch (err) {
    console.error(`[cruise-enrichment] Failed to lookup ship ${entityCode}:`, err);
    return null;
  }
}

async function lookupCabins(shipEntityCode: string): Promise<Record<string, PIMCabinData>> {
  try {
    const { PIMProduct } = await connectWithModels(CRUISE_TENANT_DB);
    const cabins = await PIMProduct.find(
      {
        parent_entity_code: shipEntityCode,
        isCurrent: true,
        entity_code: { $ne: shipEntityCode }, // exclude the ship itself
      },
      { entity_code: 1, description: 1, images: 1, attributes: 1 },
    ).lean();

    const result: Record<string, PIMCabinData> = {};
    for (const cabin of cabins) {
      // Extract cabin code/category from attributes (handles both array and object format)
      const rawAttrs = (cabin.attributes as any)?.it;
      let catValue: string | undefined;
      let codeValue: string | undefined;

      if (Array.isArray(rawAttrs)) {
        catValue = rawAttrs.find((a: any) => a.key === "cabin_category")?.value;
        codeValue = rawAttrs.find((a: any) => a.key === "cabin_code")?.value;
      } else if (rawAttrs && typeof rawAttrs === "object") {
        catValue = rawAttrs.cabin_category?.value ?? rawAttrs.cabin_category;
        codeValue = rawAttrs.cabin_code?.value ?? rawAttrs.cabin_code;
      }

      const key = codeValue || catValue || (cabin.entity_code as string);

      result[key] = {
        description: cabin.description as Record<string, string> | undefined,
        images: ((cabin.images as any[]) || []).map((img) => ({
          url: img.url,
          cdn_key: img.cdn_key,
          position: img.position ?? 0,
        })),
      };
    }
    return result;
  } catch (err) {
    console.error(`[cruise-enrichment] Failed to lookup cabins for ${shipEntityCode}:`, err);
    return {};
  }
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Enrich a single cruise detail with PIM ship + cabin data.
 */
export async function enrichCruiseDetail(ocCruise: any): Promise<any> {
  if (!ocCruise?.ship?.code || !ocCruise?.company?.short_name) return ocCruise;

  const entityCode = shipEntityCode(ocCruise.company.short_name, ocCruise.ship.code);
  const [pimShip, pimCabins] = await Promise.all([
    lookupShip(entityCode),
    lookupCabins(entityCode),
  ]);

  return {
    ...ocCruise,
    pim_ship: pimShip || undefined,
    pim_cabins: Object.keys(pimCabins).length > 0 ? pimCabins : undefined,
  };
}

/**
 * Enrich a list of cruises (lightweight — only ship cover image + star rating).
 */
export async function enrichCruiseList(ocCruises: any[]): Promise<any[]> {
  if (!ocCruises?.length) return ocCruises;

  // Collect unique ship entity codes
  const entityCodes = new Map<string, string>();
  for (const cruise of ocCruises) {
    if (cruise?.ship?.code && cruise?.company?.short_name) {
      const ec = shipEntityCode(cruise.company.short_name, cruise.ship.code);
      entityCodes.set(ec, ec);
    }
  }

  // Batch lookup all unique ships
  const shipMap = new Map<string, PIMShipData | null>();
  await Promise.all(
    Array.from(entityCodes.keys()).map(async (ec) => {
      shipMap.set(ec, await lookupShip(ec));
    }),
  );

  // Enrich each cruise with lightweight ship data
  return ocCruises.map((cruise) => {
    if (!cruise?.ship?.code || !cruise?.company?.short_name) return cruise;
    const ec = shipEntityCode(cruise.company.short_name, cruise.ship.code);
    const pimShip = shipMap.get(ec);
    if (!pimShip) return cruise;

    return {
      ...cruise,
      pim_ship: {
        images: pimShip.images,
        attributes: pimShip.attributes,
      },
    };
  });
}
