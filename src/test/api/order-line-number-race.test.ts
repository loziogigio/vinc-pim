/**
 * Integration Tests: atomic line-number reservation (concurrency)
 *
 * Regression for the duplicate-line bug (order aE-3OxY1HOlS, hidros-it):
 * two concurrent `POST /orders/[id]/items` requests both computed
 * `max(line_number)+10` from the same loaded snapshot and both produced
 * line_number 100 → ERP export hit "Duplicate entry '...-100' for key
 * 'PRIMARY'". `reserveLineNumber` claims a unique number atomically so
 * concurrent adds can never collide.
 *
 * Uses MongoMemoryServer (real mongod) so the aggregation-pipeline update
 * and its document-level atomicity are exercised for real.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { OrderModel } from "@/lib/db/models/order";
import { reserveLineNumber, createLineItem } from "@/lib/services/order.service";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";

const TENANT = "test-tenant";

function baseOrder(orderId: string, lineNumbers: number[]) {
  return {
    order_id: orderId,
    year: 2026,
    status: "draft",
    tenant_id: TENANT,
    session_id: "s",
    flow_id: "f",
    price_list_id: "default",
    items: lineNumbers.map((ln) => ({
      line_number: ln,
      entity_code: `E${ln}`,
      sku: `S${ln}`,
      quantity: 1,
      list_price: 1,
      unit_price: 1,
      vat_rate: 22,
      name: `item ${ln}`,
    })),
  };
}

describe("reserveLineNumber (atomic, monotonic, unique)", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await clearDatabase();
  });

  it("starts at 10 for an empty cart", async () => {
    await OrderModel.create(baseOrder("ord-empty", []));
    expect(await reserveLineNumber(OrderModel, "ord-empty")).toBe(10);
  });

  it("continues from the existing max for a legacy cart (no line_counter)", async () => {
    await OrderModel.create(baseOrder("ord-legacy", [10, 20, 90]));
    expect(await reserveLineNumber(OrderModel, "ord-legacy")).toBe(100);
    expect(await reserveLineNumber(OrderModel, "ord-legacy")).toBe(110);
  });

  it("is monotonic — never reuses a number even after the max line is deleted", async () => {
    await OrderModel.create(baseOrder("ord-mono", [10, 20]));
    expect(await reserveLineNumber(OrderModel, "ord-mono")).toBe(30);
    // delete the highest item; counter must NOT fall back to reusing 30
    await OrderModel.updateOne(
      { order_id: "ord-mono" },
      { $pull: { items: { line_number: 20 } } },
    );
    expect(await reserveLineNumber(OrderModel, "ord-mono")).toBe(40);
  });

  it("yields unique numbers under concurrency (the core race)", async () => {
    await OrderModel.create(baseOrder("ord-race", [10, 20, 90]));
    const N = 25;
    const results = await Promise.all(
      Array.from({ length: N }, () => reserveLineNumber(OrderModel, "ord-race")),
    );
    const unique = new Set(results);
    expect(unique.size).toBe(N); // no duplicates
    // strictly the contiguous block 100,110,...,(100+10*(N-1))
    expect([...results].sort((a, b) => a - b)).toEqual(
      Array.from({ length: N }, (_, i) => 100 + i * 10),
    );
  });
});

describe("createLineItem line-number assignment", () => {
  it("uses an explicit line number when provided", () => {
    const order = { items: [{ line_number: 10 }], price_decimals: 2 } as never;
    const body = {
      entity_code: "X",
      sku: "X",
      quantity: 1,
      list_price: 1,
      unit_price: 1,
      vat_rate: 22,
      name: "x",
    } as never;
    expect(createLineItem(order, body, 250).line_number).toBe(250);
  });

  it("falls back to max+10 when no explicit number is given", () => {
    const order = { items: [{ line_number: 40 }], price_decimals: 2 } as never;
    const body = {
      entity_code: "X",
      sku: "X",
      quantity: 1,
      list_price: 1,
      unit_price: 1,
      vat_rate: 22,
      name: "x",
    } as never;
    expect(createLineItem(order, body).line_number).toBe(50);
  });
});
