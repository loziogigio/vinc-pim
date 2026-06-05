import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { PIMProductSchema } from "@/lib/db/models/pim-product";
import type { DynamicBlock } from "@/lib/types/dynamic-blocks";

describe("PIMProduct dynamic_blocks", () => {
  let mongod: MongoMemoryServer;
  let conn: mongoose.Connection;
  let Product: mongoose.Model<any>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    Product = conn.model("PIMProduct", PIMProductSchema);
  }, 30000);

  beforeEach(async () => {
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  it("declares a dynamic_blocks array path (not Mixed)", () => {
    const path = PIMProductSchema.paths["dynamic_blocks"];
    expect(path).toBeDefined();
    expect(path.instance).toBe("Array");
    expect((path as any).caster?.instance).not.toBe("Mixed");
  });

  it("persists and serializes a media block with nested element fields", async () => {
    const block: DynamicBlock = {
      id: "blk_01",
      lang: "it",
      title: "Brevetti",
      section: 1,
      order: 0,
      columns: 2,
      is_active: true,
      elements: [
        {
          id: "e1",
          kind: "image",
          media: {
            url: "https://cdn.example/patent1.png",
            cdn_key: "products/536914/blocks/p1.png",
            is_external_link: false,
            alt: "Brevetto 1",
          },
          link: { href: "https://patents.example/1", new_tab: true },
          description: "Descrizione 1",
        },
        { id: "e2", kind: "text", text: "Testo del blocco" },
      ],
    };

    const doc = await Product.create({
      entity_code: "536914",
      sku: "536914",
      dynamic_blocks: [block],
    });

    const reloaded = await Product.findById(doc._id).lean<any>();
    expect(reloaded.dynamic_blocks).toHaveLength(1);

    const saved = reloaded.dynamic_blocks[0];
    expect(saved.id).toBe("blk_01");
    expect(saved.lang).toBe("it");
    expect(saved.title).toBe("Brevetti");
    expect(saved.section).toBe(1);
    expect(saved.order).toBe(0);
    expect(saved.columns).toBe(2);
    expect(saved.is_active).toBe(true);
    expect(saved.elements).toHaveLength(2);

    const media = saved.elements[0];
    expect(media.kind).toBe("image");
    expect(media.media.url).toBe("https://cdn.example/patent1.png");
    expect(media.media.cdn_key).toBe("products/536914/blocks/p1.png");
    expect(media.media.is_external_link).toBe(false);
    expect(media.media.alt).toBe("Brevetto 1");
    expect(media.link).toEqual({ href: "https://patents.example/1", new_tab: true });
    expect(media.description).toBe("Descrizione 1");

    const text = saved.elements[1];
    expect(text.kind).toBe("text");
    expect(text.text).toBe("Testo del blocco");

    const json = doc.toJSON();
    expect(json.dynamic_blocks[0].elements[0].media.url).toBe("https://cdn.example/patent1.png");
  });

  it("defaults is_active to true and applies enum constraints on section/columns", async () => {
    const doc = await Product.create({
      entity_code: "P2",
      sku: "P2",
      dynamic_blocks: [
        { id: "blk_02", lang: "de", section: 2, order: 0, columns: 4, elements: [] },
      ],
    });
    expect(doc.dynamic_blocks[0].is_active).toBe(true);

    await expect(
      Product.create({
        entity_code: "P3",
        sku: "P3",
        dynamic_blocks: [
          { id: "blk_03", lang: "it", section: 9, order: 0, columns: 2, elements: [] },
        ],
      })
    ).rejects.toThrow();
  });
});
