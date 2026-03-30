/**
 * Cruise Sync Service
 *
 * Syncs cruise reference data from OC aggregator + CDN manifest into VCS PIM:
 * - Phase 1: Brands (companies), Categories (destinations), Ship products, Cabin products
 * - Phase 2: Departures (individual sailings with resources + metadata)
 */

import { connectWithModels } from "@/lib/db/connection";
import { ocFetch } from "@/lib/services/oc-client";
import {
  CDN_BASE_URL,
  CRUISE_COMPANIES,
  cabinCodeToCategory,
  CABIN_CATEGORY_LABELS,
} from "@/lib/constants/cruise";
import type {
  OCFlatCruiseSync,
  CruiseDepartureMetadata,
} from "@/lib/types/cruise";
import { nanoid } from "nanoid";
import fs from "fs";
import path from "path";

// ============================================
// TYPES
// ============================================

interface SyncStats {
  brands: { created: number; updated: number };
  categories: { created: number; updated: number };
  ships: { created: number; updated: number };
  cabins: { created: number; updated: number };
  departures: { created: number; updated: number };
  errors: string[];
}

interface ManifestImage {
  ship_name?: string;
  ship_code?: string;
  cabin_name?: string;
  area_name?: string;
  company_name?: string;
  filename: string;
  uri: string;
  position?: string;
}

interface CDNManifest {
  ship_main_images: ManifestImage[];
  ship_gallery: ManifestImage[];
  ship_deck_images: ManifestImage[];
  cabin_main_images: ManifestImage[];
  cabin_gallery: ManifestImage[];
  destination_images: ManifestImage[];
  company_logos: ManifestImage[];
  company_images: ManifestImage[];
}

// ============================================
// MANIFEST LOADER
// ============================================

let _manifest: CDNManifest | null = null;

function loadManifest(): CDNManifest {
  if (_manifest) return _manifest;
  const manifestPath = path.resolve(
    process.cwd(),
    "../offerte-crociere/media_export/manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`CDN manifest not found at ${manifestPath}`);
  }
  _manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  return _manifest!;
}

function cdnUrl(uri: string): string {
  // Convert "public://ships/gallery/file.jpg" → "{CDN_BASE}/ships/gallery/file.jpg"
  const relative = uri.replace("public://", "");
  return `${CDN_BASE_URL}/${encodeURI(relative)}`;
}

function manifestImages(
  items: ManifestImage[],
  filterFn?: (item: ManifestImage) => boolean
): Array<{ url: string; cdn_key: string; position: number }> {
  const filtered = filterFn ? items.filter(filterFn) : items;
  return filtered.map((item, idx) => ({
    url: cdnUrl(item.uri),
    cdn_key: item.uri.replace("public://", ""),
    position: item.position ? parseInt(item.position) : idx,
  }));
}

// ============================================
// PHASE 1: REFERENCE DATA
// ============================================

export async function syncReferenceData(
  tenantDb: string,
  tenantId: string
): Promise<Omit<SyncStats, "departures">> {
  const manifest = loadManifest();
  const { Brand, Category, PIMProduct, ImportSource } =
    await connectWithModels(tenantDb);

  const stats: Omit<SyncStats, "departures"> = {
    brands: { created: 0, updated: 0 },
    categories: { created: 0, updated: 0 },
    ships: { created: 0, updated: 0 },
    cabins: { created: 0, updated: 0 },
    errors: [],
  };

  // Ensure import source exists
  await ImportSource.updateOne(
    { source_id: "oc-aggregator" },
    {
      $setOnInsert: {
        source_id: "oc-aggregator",
        source_name: "Offerte Crociere Aggregator",
        source_type: "api",
        auto_publish_enabled: true,
        is_active: true,
      },
    },
    { upsert: true }
  );

  // --- Brands ---
  for (const [key, company] of Object.entries(CRUISE_COMPANIES)) {
    const logoItem = manifest.company_logos.find(
      (l) => l.company_name?.toLowerCase().includes(key)
    );
    const imageItem = manifest.company_images.find(
      (i) => i.company_name?.toLowerCase().includes(key)
    );

    const brandData: Record<string, unknown> = {
      brand_id: company.brand_id,
      label: company.label,
      slug: company.slug,
    };
    if (logoItem) {
      brandData.logo_url = cdnUrl(logoItem.uri);
      brandData.logo_cdn_key = logoItem.uri.replace("public://", "");
    }
    if (imageItem) {
      brandData.mobile_logo_url = cdnUrl(imageItem.uri);
    }

    const result = await Brand.updateOne(
      { brand_id: company.brand_id },
      { $set: brandData },
      { upsert: true }
    );
    if (result.upsertedCount) stats.brands.created++;
    else if (result.modifiedCount) stats.brands.updated++;
  }

  // --- Categories (destinations) ---
  const destImages = manifest.destination_images;
  // Also fetch from OC filters for real destination names + counts
  let ocDestinations: Array<{ name: string; count: number }> = [];
  try {
    const filtersResp = await ocFetch<{ data: { destinations: Array<{ name: string; count: number }> } }>(
      "/catalog/filters"
    );
    ocDestinations = filtersResp.data.destinations;
  } catch {
    // Fallback: use manifest destination names
  }

  const allDestinations = ocDestinations.length > 0
    ? ocDestinations
    : destImages.map((d) => ({ name: d.area_name || d.filename.replace(/_/g, " "), count: 0 }));

  for (const dest of allDestinations) {
    const slug = dest.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const categoryId = `dest-${slug}`;

    const heroImage = destImages.find((d) => {
      const areaSlug = (d.area_name || d.filename)
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      return areaSlug.includes(slug.replace(/-/g, "").substring(0, 8));
    });

    const catData: Record<string, unknown> = {
      category_id: categoryId,
      name: dest.name,
      slug,
      level: 0,
      path: [],
      channel_code: "crociere",
      is_active: true,
    };
    if (heroImage) {
      catData.hero_image = {
        url: cdnUrl(heroImage.uri),
        cdn_key: heroImage.uri.replace("public://", ""),
      };
    }

    const result = await Category.updateOne(
      { category_id: categoryId },
      { $set: catData },
      { upsert: true }
    );
    if (result.upsertedCount) stats.categories.created++;
    else if (result.modifiedCount) stats.categories.updated++;
  }

  // --- Ships (PIM Products, kind=bookable) ---
  // Fetch all cruises from OC to get unique ships
  let allCruises: OCFlatCruiseSync[] = [];
  try {
    let page = 1;
    while (true) {
      const resp = await ocFetch<{ data: OCFlatCruiseSync[]; meta: { total: number; page_size: number } }>(
        "/catalog/cruises",
        { page: String(page), limit: "100" }
      );
      allCruises.push(...resp.data);
      if (allCruises.length >= resp.meta.total) break;
      page++;
    }
  } catch (err) {
    stats.errors.push(`Failed to fetch OC cruises: ${(err as Error).message}`);
    return stats;
  }

  // Unique ships
  const shipsMap = new Map<string, { name: string; code: string; company: string }>();
  for (const cruise of allCruises) {
    const shipKey = `${cruise.company.short_name}-${cruise.ship.code}`.toLowerCase();
    if (!shipsMap.has(shipKey)) {
      shipsMap.set(shipKey, {
        name: cruise.ship.name,
        code: cruise.ship.code,
        company: cruise.company.short_name,
      });
    }
  }

  for (const [shipKey, ship] of shipsMap) {
    const entityCode = `ship-${shipKey}`;
    const companyKey = ship.company.toLowerCase() as keyof typeof CRUISE_COMPANIES;
    const brand = CRUISE_COMPANIES[companyKey] || { brand_id: ship.company.toLowerCase(), label: ship.company };

    // Find images from manifest — match by ship_code (case-insensitive)
    const codeUpper = ship.code.toUpperCase();
    const mainImages = manifestImages(
      manifest.ship_main_images,
      (i) => (i.ship_code || "").toUpperCase() === codeUpper
    );
    const galleryImages = manifestImages(
      manifest.ship_gallery,
      (i) => (i.ship_code || "").toUpperCase() === codeUpper
    );
    const allImages = [...mainImages, ...galleryImages].slice(0, 20);
    // Re-index positions
    allImages.forEach((img, idx) => (img.position = idx));

    const existing = await PIMProduct.findOne({
      entity_code: entityCode,
      isCurrent: true,
    });

    if (existing) {
      // Update images + brand only if not manually edited
      if (!existing.manually_edited) {
        await PIMProduct.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: { it: ship.name, en: ship.name },
              brand: { brand_id: brand.brand_id, label: brand.label },
              product_kind: "bookable",
              channels: ["crociere"],
              ...(allImages.length > 0 ? { images: allImages } : {}),
            },
          }
        );
        stats.ships.updated++;
      }
    } else {
      await PIMProduct.create({
        entity_code: entityCode,
        sku: entityCode.toUpperCase(),
        name: { it: ship.name, en: ship.name },
        product_kind: "bookable",
        is_parent: true,
        brand: { brand_id: brand.brand_id, label: brand.label },
        channels: ["crociere"],
        images: allImages,
        status: "published",
        isCurrent: true,
        isCurrentPublished: true,
        version: 1,
        source: {
          source_id: "oc-aggregator",
          source_name: "Offerte Crociere Aggregator",
          imported_at: new Date(),
        },
      });
      stats.ships.created++;
    }
  }

  // --- Cabins (PIM Products, kind=standard, children of ships) ---
  // Collect unique cabin codes per ship from all cruise prices
  const cabinMap = new Map<string, { shipKey: string; code: string; name: string; category: string }>();
  for (const cruise of allCruises) {
    const shipKey = `${cruise.company.short_name}-${cruise.ship.code}`.toLowerCase();
    for (const price of cruise.prices) {
      const code = price.cabin_type.code;
      const key = `${shipKey}-${code}`.toLowerCase();
      if (!cabinMap.has(key)) {
        cabinMap.set(key, {
          shipKey,
          code,
          name: price.cabin_type.name || code,
          category: price.cabin_type.category || cabinCodeToCategory(code),
        });
      }
    }
  }

  for (const [cabinKey, cabin] of cabinMap) {
    const entityCode = `cabin-${cabinKey}`;
    const parentEntityCode = `ship-${cabin.shipKey}`;
    const categoryLabel = CABIN_CATEGORY_LABELS[cabin.category] || { it: cabin.category, en: cabin.category };

    // Find cabin images from manifest
    // 1. Try cabin_gallery matching by ship name in filename
    const shipNameLower = shipsMap.get(cabin.shipKey)?.name.toLowerCase() || "";
    const categoryKeywords: Record<string, string[]> = {
      interior: ["interna", "interior", "inside"],
      ocean_view: ["esterna", "ocean", "outside", "finestra", "vista mare"],
      balcony: ["balcon", "balcone", "veranda"],
      suite: ["suite", "yacht club"],
    };
    const keywords = categoryKeywords[cabin.category] || [];
    const cabinImages = manifestImages(
      manifest.cabin_gallery,
      (i) => {
        const fname = (i.filename || "").toLowerCase();
        const cname = (i.cabin_name || "").toLowerCase();
        const hasShip = shipNameLower && fname.includes(shipNameLower.split(" ").pop() || "");
        const hasCat = keywords.some((kw) => cname.includes(kw) || fname.includes(kw));
        return hasShip && hasCat;
      }
    ).slice(0, 3);

    // 2. Fallback: generic cabin images by category from cabin_main_images
    if (cabinImages.length === 0) {
      const fallback = manifestImages(
        manifest.cabin_main_images,
        (i) => keywords.some((kw) => (i.cabin_name || "").toLowerCase().includes(kw))
      ).slice(0, 1);
      cabinImages.push(...fallback);
    }

    const existing = await PIMProduct.findOne({
      entity_code: entityCode,
      isCurrent: true,
    });

    if (existing) {
      if (!existing.manually_edited) {
        await PIMProduct.updateOne(
          { _id: existing._id },
          {
            $set: {
              name: { it: cabin.name, en: cabin.name },
              parent_entity_code: parentEntityCode,
              attributes: {
                it: [
                  { key: "cabin_category", label: "Categoria", value: categoryLabel.it },
                  { key: "cabin_code", label: "Codice", value: cabin.code },
                ],
                en: [
                  { key: "cabin_category", label: "Category", value: categoryLabel.en },
                  { key: "cabin_code", label: "Code", value: cabin.code },
                ],
              },
              ...(cabinImages.length > 0 ? { images: cabinImages } : {}),
            },
          }
        );
        stats.cabins.updated++;
      }
    } else {
      await PIMProduct.create({
        entity_code: entityCode,
        sku: entityCode.toUpperCase(),
        name: { it: cabin.name, en: cabin.name },
        product_kind: "standard",
        is_parent: false,
        parent_entity_code: parentEntityCode,
        channels: ["crociere"],
        attributes: {
          it: [
            { key: "cabin_category", label: "Categoria", value: categoryLabel.it },
            { key: "cabin_code", label: "Codice", value: cabin.code },
          ],
          en: [
            { key: "cabin_category", label: "Category", value: categoryLabel.en },
            { key: "cabin_code", label: "Code", value: cabin.code },
          ],
        },
        images: cabinImages,
        status: "published",
        isCurrent: true,
        isCurrentPublished: true,
        version: 1,
        source: {
          source_id: "oc-aggregator",
          source_name: "Offerte Crociere Aggregator",
          imported_at: new Date(),
        },
      });
      stats.cabins.created++;
    }
  }

  return stats;
}

// ============================================
// PHASE 2: DEPARTURES
// ============================================

export async function syncDepartures(
  tenantDb: string,
  tenantId: string
): Promise<{ created: number; updated: number; cabinsCreated: number; errors: string[] }> {
  const { Departure, PIMProduct } = await connectWithModels(tenantDb);

  const stats = { created: 0, updated: 0, cabinsCreated: 0, errors: [] as string[] };

  // Fetch all active cruises from OC
  let allCruises: OCFlatCruiseSync[] = [];
  try {
    let page = 1;
    while (true) {
      const resp = await ocFetch<{ data: OCFlatCruiseSync[]; meta: { total: number; page_size: number } }>(
        "/catalog/cruises",
        { page: String(page), limit: "100" }
      );
      allCruises.push(...resp.data);
      if (allCruises.length >= resp.meta.total) break;
      page++;
    }
  } catch (err) {
    stats.errors.push(`Failed to fetch OC cruises: ${(err as Error).message}`);
    return stats;
  }

  // Pre-step: auto-create missing cabin PIM products
  for (const cruise of allCruises) {
    const shipKey = `${cruise.company.short_name}-${cruise.ship.code}`.toLowerCase();
    for (const price of cruise.prices) {
      const cabinKey = `${shipKey}-${price.cabin_type.code}`.toLowerCase();
      const cabinEntityCode = `cabin-${cabinKey}`;
      const parentEntityCode = `ship-${shipKey}`;
      const existing = await PIMProduct.findOne({
        entity_code: cabinEntityCode,
        isCurrent: true,
      });
      if (!existing) {
        try {
          const category = price.cabin_type.category || cabinCodeToCategory(price.cabin_type.code);
          const categoryLabel = CABIN_CATEGORY_LABELS[category] || { it: category, en: category };
          await PIMProduct.create({
            entity_code: cabinEntityCode,
            sku: cabinEntityCode.toUpperCase(),
            name: { it: price.cabin_type.name || price.cabin_type.code, en: price.cabin_type.name || price.cabin_type.code },
            product_kind: "standard",
            is_parent: false,
            parent_entity_code: parentEntityCode,
            share_images_with_variants: true,
            channels: ["crociere"],
            attributes: {
              it: [
                { key: "cabin_category", label: "Categoria", value: categoryLabel.it },
                { key: "cabin_code", label: "Codice", value: price.cabin_type.code },
              ],
              en: [
                { key: "cabin_category", label: "Category", value: categoryLabel.en },
                { key: "cabin_code", label: "Code", value: price.cabin_type.code },
              ],
            },
            images: [],
            status: "published",
            isCurrent: true,
            isCurrentPublished: true,
            version: 1,
            source: {
              source_id: "oc-aggregator",
              source_name: "Offerte Crociere Aggregator",
              imported_at: new Date(),
            },
          });
          stats.cabinsCreated++;
        } catch {
          // Ignore duplicate key errors from concurrent creation
        }
      }
    }
  }

  for (const cruise of allCruises) {
    try {
      const shipKey = `${cruise.company.short_name}-${cruise.ship.code}`.toLowerCase();
      const productEntityCode = `ship-${shipKey}`;

      // Build metadata
      const metadata: CruiseDepartureMetadata = {
        oc_cruise_id: cruise.cruise_id,
        destination_area: cruise.destination_area,
        departure_port: cruise.departure_port,
        duration_nights: cruise.duration_nights,
        itinerary: cruise.ports.map((p, idx) => ({
          day: idx + 1,
          port: p.name,
          country_code: p.country_code,
          arrival: p.arrival,
          departure: p.departure,
          sort_order: p.sort_order,
        })),
        booking_url: cruise.booking_url || undefined,
        immediate_confirm: cruise.immediate_confirm,
        image_url: cruise.image_url || undefined,
      };

      // Build resources from prices
      const resources = cruise.prices.map((price) => {
        const cabinKey = `${shipKey}-${price.cabin_type.code}`.toLowerCase();
        return {
          resource_id: nanoid(11),
          resource_type: "cabin" as const,
          child_entity_code: `cabin-${cabinKey}`,
          total_capacity: price.availability ?? 100,
          available: price.availability ?? 100,
          held: 0,
          booked: 0,
          price_override: price.price_per_person,
          currency: price.currency || "EUR",
        };
      });

      // Check if departure already exists for this OC cruise
      const existing = await Departure.findOne({
        tenant_id: tenantId,
        "metadata.oc_cruise_id": cruise.cruise_id,
      });

      if (existing) {
        // Update prices + metadata, preserve capacity counters
        const updatedResources = resources.map((newRes) => {
          const oldRes = existing.resources.find(
            (r: { child_entity_code: string }) => r.child_entity_code === newRes.child_entity_code
          );
          if (oldRes) {
            return {
              ...newRes,
              resource_id: oldRes.resource_id,
              available: oldRes.available,
              held: oldRes.held,
              booked: oldRes.booked,
            };
          }
          return newRes;
        });

        await Departure.updateOne(
          { _id: existing._id },
          {
            $set: {
              label: `${cruise.company.name} — ${cruise.ship.name} — ${cruise.departure_date.substring(0, 10)}`,
              metadata,
              resources: updatedResources,
            },
          }
        );
        stats.updated++;
      } else {
        await Departure.create({
          departure_id: nanoid(11),
          tenant_id: tenantId,
          product_entity_code: productEntityCode,
          label: `${cruise.company.name} — ${cruise.ship.name} — ${cruise.departure_date.substring(0, 10)}`,
          status: "active",
          starts_at: new Date(cruise.departure_date),
          ends_at: new Date(cruise.return_date),
          booking_cutoff_at: new Date(
            new Date(cruise.departure_date).getTime() - 24 * 60 * 60 * 1000
          ),
          resources,
          metadata,
        });
        stats.created++;
      }
    } catch (err) {
      stats.errors.push(
        `Cruise ${cruise.cruise_id}: ${(err as Error).message}`
      );
    }
  }

  return stats;
}

// ============================================
// FULL SYNC (Phase 1 + Phase 2)
// ============================================

export async function syncAll(
  tenantDb: string,
  tenantId: string
): Promise<SyncStats> {
  console.log("[cruise-sync] Starting full sync for", tenantId);

  const refStats = await syncReferenceData(tenantDb, tenantId);
  console.log("[cruise-sync] Reference data:", refStats);

  const depStats = await syncDepartures(tenantDb, tenantId);
  console.log("[cruise-sync] Departures:", depStats);

  return {
    ...refStats,
    departures: { created: depStats.created, updated: depStats.updated },
    cabins: {
      ...refStats.cabins,
      created: refStats.cabins.created + (depStats.cabinsCreated || 0),
    },
    errors: [...refStats.errors, ...depStats.errors],
  };
}
