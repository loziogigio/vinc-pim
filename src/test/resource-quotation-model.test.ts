import { describe, expect, it } from "vitest";
import { LineItemSchema, OrderSchema } from "@/lib/db/models/order";

describe("ILineItem resource-quotation extensions", () => {
  it("LineItemSchema declares resource_type path", () => {
    expect(LineItemSchema.paths["resource_type"]).toBeDefined();
  });
  it("LineItemSchema declares source path", () => {
    expect(LineItemSchema.paths["source"]).toBeDefined();
  });
  it("LineItemSchema declares departure_id path", () => {
    expect(LineItemSchema.paths["departure_id"]).toBeDefined();
  });
  it("LineItemSchema declares resource_id path", () => {
    expect(LineItemSchema.paths["resource_id"]).toBeDefined();
  });
  it("LineItemSchema declares booking_id path", () => {
    expect(LineItemSchema.paths["booking_id"]).toBeDefined();
  });
  it("LineItemSchema declares quote_snapshot path (Mixed)", () => {
    expect(LineItemSchema.paths["quote_snapshot"]).toBeDefined();
  });
  it("OrderSchema declares public_token path", () => {
    expect(OrderSchema.paths["public_token"]).toBeDefined();
  });
  it("OrderSchema has unique sparse index on public_token", () => {
    const indexes = OrderSchema.indexes();
    const tokenIdx = indexes.find(
      ([fields]) => "public_token" in fields
    );
    expect(tokenIdx).toBeDefined();
    expect(tokenIdx![1]).toMatchObject({ unique: true, sparse: true });
  });
});
