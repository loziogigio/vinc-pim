/**
 * VINC Demo — shared seeding helpers (Phase A).
 *
 * Idempotent building blocks shared by provision-demo-tenant.ts (task A2) and
 * reset-demo-tenant.ts (task A6). Each helper assumes the DEFAULT mongoose
 * connection is already bound to the demo tenant DB (via connectToTenantDb),
 * except those that explicitly use the app connection pool (ensureStorefront).
 *
 * Heavy app models/services are imported lazily so a caller can `--dry-run`
 * without loading the database layer.
 */

import bcrypt from "bcryptjs";
import {
  DEMO_TENANT_ID,
  DEMO_DB_NAME,
  DEMO_DOMAINS,
  DEMO_SALES_CHANNELS,
  DEMO_CUSTOMERS,
  DEMO_PORTAL_USERS,
  DEMO_STOREFRONT,
  type DemoPasswords,
} from "./demo-config.js";
import { buildDemoCatalog, DEMO_SOURCE } from "./demo-catalog.js";
import { buildDemoCategories } from "./demo-categories.js";
import { DEMO_DISCOUNT_PREFIX } from "./demo-pricing.js";
import { ORDER_HISTORY_DEFINITIONS, buildOrderHistoryRecords } from "./demo-order-history.js";

export const log = (msg: string) => console.log(msg);
export const step = (msg: string) => console.log(`\n▸ ${msg}`);

export async function ensureChannels(): Promise<void> {
  step("Sales channels");
  const { nanoid } = await import("nanoid");
  const { SalesChannelModel } = await import("../../src/lib/db/models/sales-channel.js");
  for (const ch of DEMO_SALES_CHANNELS) {
    await SalesChannelModel.updateOne(
      { code: ch.code },
      {
        $set: { name: ch.name, is_default: ch.is_default, is_active: true, color: ch.color },
        $setOnInsert: { channel_id: `ch_${nanoid(8)}` },
      },
      { upsert: true }
    );
    log(`  ✓ channel '${ch.code}'${ch.is_default ? " (default)" : ""}`);
  }
}

export async function ensureCustomerTags(): Promise<void> {
  step("Customer tags");
  const { nanoid } = await import("nanoid");
  const { CustomerTagModel } = await import("../../src/lib/db/models/customer-tag.js");
  for (const code of ["premium", "standard"]) {
    const full_tag = `${DEMO_DISCOUNT_PREFIX}:${code}`;
    await CustomerTagModel.updateOne(
      { full_tag },
      {
        $set: {
          prefix: DEMO_DISCOUNT_PREFIX, code, full_tag,
          description: code === "premium" ? "Listino premium (−15%)" : "Listino standard (−7%)",
          is_active: true,
        },
        $setOnInsert: { tag_id: `ctag_${nanoid(8)}` },
      },
      { upsert: true }
    );
    log(`  ✓ tag '${full_tag}'`);
  }
}

export async function ensureCustomers(): Promise<void> {
  step("Customers");
  const { CustomerModel } = await import("../../src/lib/db/models/customer.js");
  for (const c of DEMO_CUSTOMERS) {
    const addressId = `addr-${c.customer_id}`;
    const tagRef = c.discount_tag
      ? { tag_id: `ctag-demo-${c.discount_tag}`, full_tag: `${DEMO_DISCOUNT_PREFIX}:${c.discount_tag}`, prefix: DEMO_DISCOUNT_PREFIX, code: c.discount_tag }
      : null;
    await CustomerModel.updateOne(
      { customer_id: c.customer_id },
      {
        $set: {
          tenant_id: DEMO_TENANT_ID,
          external_code: c.external_code,
          public_code: c.external_code,
          customer_type: c.customer_type,
          channel: c.channel,
          email: c.email,
          company_name: c.company_name,
          legal_info: c.vat ? { vat_number: c.vat } : undefined,
          tags: tagRef ? [tagRef] : [],
          addresses: [
            {
              address_id: addressId,
              address_type: "both",
              is_default: true,
              recipient_name: c.company_name,
              street_address: c.street,
              city: c.city,
              province: c.province,
              postal_code: c.postal_code,
              country: "IT",
              tag_overrides: tagRef ? [tagRef] : [],
            },
          ],
          default_shipping_address_id: addressId,
          default_billing_address_id: addressId,
        },
      },
      { upsert: true }
    );
    log(`  ✓ customer '${c.company_name}' (${c.channel})${tagRef ? ` [tag: ${tagRef.full_tag}]` : ""}`);
  }
}

export async function ensurePortalUsers(pwds: DemoPasswords): Promise<void> {
  step("Portal users");
  const { PortalUserModel } = await import("../../src/lib/db/models/portal-user.js");
  // Clean slate so renamed/stale demo logins (e.g. old short usernames) don't linger.
  const removed = await PortalUserModel.deleteMany({ tenant_id: DEMO_TENANT_ID });
  if (removed.deletedCount) log(`  • removed ${removed.deletedCount} prior demo portal user(s)`);
  for (const u of DEMO_PORTAL_USERS) {
    const passwordHash = await bcrypt.hash(pwds[u.passwordKey], 10);
    await PortalUserModel.updateOne(
      { tenant_id: DEMO_TENANT_ID, username: u.username, channel: u.channel },
      {
        $set: {
          email: u.email,
          password_hash: passwordHash,
          customer_access: [{ customer_id: u.customer_id, address_access: "all" }],
          is_active: true,
        },
        $setOnInsert: { portal_user_id: `pu-${u.username}-${u.channel}` },
      },
      { upsert: true }
    );
    log(`  ✓ ${u.channel} user '${u.username}' → ${u.customer_id}`);
  }
}

export async function seedCatalog(now: Date): Promise<void> {
  step("Catalog");
  const { PIMProductModel } = await import("../../src/lib/db/models/pim-product.js");
  const products = buildDemoCatalog(now);
  const removed = await PIMProductModel.deleteMany({ "source.source_id": DEMO_SOURCE.source_id });
  await PIMProductModel.insertMany(products, { ordered: false });
  log(`  ✓ removed ${removed.deletedCount ?? 0} prior demo products, inserted ${products.length}`);
}

export async function seedCategories(): Promise<void> {
  step("Categories");
  const { CategoryModel } = await import("../../src/lib/db/models/category.js");
  const cats = buildDemoCategories();
  const ids = cats.map((c) => c.category_id);
  const removed = await CategoryModel.deleteMany({ category_id: { $in: ids } });
  await CategoryModel.insertMany(cats, { ordered: false });
  log(`  ✓ removed ${removed.deletedCount ?? 0} prior demo categories, inserted ${cats.length}`);
}

export async function ensureStorefront(): Promise<void> {
  step("B2C storefront");
  const { createStorefront } = await import("../../src/lib/services/b2c-storefront.service.js");
  try {
    await createStorefront(DEMO_DB_NAME, DEMO_STOREFRONT as any);
    log(`  ✓ storefront '${DEMO_STOREFRONT.slug}' → ${DEMO_DOMAINS.b2c}`);
  } catch (err: any) {
    if (/already exists|already assigned/i.test(err?.message ?? "")) {
      log(`  • storefront '${DEMO_STOREFRONT.slug}' already exists — left as-is`);
    } else {
      throw err;
    }
  }
}

export async function installOrderHistoryDefinitions(): Promise<void> {
  step("Order-history data-model definitions");
  const { connectWithModels } = await import("../../src/lib/db/connection.js");
  const { getDataModelRecordModel } = await import("../../src/lib/db/model-registry.js");
  const { findExternalRefField } = await import("../../src/lib/db/models/data-model-definition.js");
  const { DataModelDefinition } = await connectWithModels(DEMO_DB_NAME);
  for (const def of ORDER_HISTORY_DEFINITIONS) {
    const external_ref_field = findExternalRefField(def.fields);
    await DataModelDefinition.updateOne(
      { slug: def.slug },
      { $set: { ...def, external_ref_field } },
      { upsert: true }
    );
    const RecordModel = await getDataModelRecordModel(DEMO_DB_NAME, {
      slug: def.slug, cardinality: def.cardinality, fields: def.fields, external_ref_field,
    });
    await RecordModel.init();
    log(`  ✓ definition '${def.slug}' (dyn_${def.slug})`);
  }
}

export async function seedOrderHistory(now: Date): Promise<void> {
  step("Order-history records");
  const { getDataModelRecordModel } = await import("../../src/lib/db/model-registry.js");
  const { findExternalRefField } = await import("../../src/lib/db/models/data-model-definition.js");
  const defBySlug = new Map(ORDER_HISTORY_DEFINITIONS.map((d) => [d.slug, d]));
  const records = buildOrderHistoryRecords(now);
  const codes = ["DEMO-C01", "DEMO-C02"];
  // Wipe prior demo records per model for the two B2B customers (idempotent).
  for (const def of ORDER_HISTORY_DEFINITIONS) {
    const RecordModel = await getDataModelRecordModel(DEMO_DB_NAME, {
      slug: def.slug, cardinality: def.cardinality, fields: def.fields,
      external_ref_field: findExternalRefField(def.fields),
    });
    await RecordModel.deleteMany({ relation_id: { $in: codes } });
  }
  let n = 0;
  for (const r of records) {
    const def = defBySlug.get(r.slug)!;
    const RecordModel = await getDataModelRecordModel(DEMO_DB_NAME, {
      slug: def.slug, cardinality: def.cardinality, fields: def.fields,
      external_ref_field: findExternalRefField(def.fields),
    });
    await RecordModel.updateOne(
      { relation_id: r.relation_id, channel: r.channel, external_ref: r.external_ref },
      { $set: { relation_id: r.relation_id, channel: r.channel, external_ref: r.external_ref, data: r.data, source: "demo-seed", imported_at: now } },
      { upsert: true }
    );
    n++;
  }
  log(`  ✓ seeded ${n} order-history records for 2 customers`);
}

/** Wipe visitor-generated carts + orders (same `orders` collection). */
export async function wipeOrders(): Promise<void> {
  step("Carts & orders");
  const { OrderModel } = await import("../../src/lib/db/models/order.js");
  const removed = await OrderModel.deleteMany({});
  log(`  ✓ removed ${removed.deletedCount ?? 0} carts/orders`);
}

/**
 * Re-seed everything that backs the three surfaces (channels, customers, portal
 * users, catalog, storefront). Used by both provisioning and reset.
 */
export async function seedDemoData(pwds: DemoPasswords, now: Date): Promise<void> {
  await ensureChannels();
  await ensureCustomerTags();              // Task 4
  await ensureCustomers();
  await ensurePortalUsers(pwds);
  await seedCatalog(now);
  await seedCategories();                  // Task 5
  await ensureStorefront();
  await installOrderHistoryDefinitions();    // Task 6
  await seedOrderHistory(now);              // Task 7
  // await ensureHomeTemplate();            // Task 12
}
