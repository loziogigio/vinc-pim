import { connectToDatabase } from "@/lib/db/connection";
import { PageModel, type PageDocument } from "@/lib/db/models/page";
import { resolveDefaultBlocks } from "@/lib/config/blockTemplates";
import { pageConfigSchema, type PageConfigInput } from "@/lib/validation/blockSchemas";
import type { BlockConfig, PageBlock, PageConfig } from "@/lib/types/blocks";

const serializeBlock = (
  block: {
    id: string;
    type: string;
    order?: number;
    config: unknown;
    metadata?: Record<string, unknown>;
  }
): PageBlock => ({
  id: block.id,
  type: block.type,
  order: block.order ?? 0,
  config: block.config as BlockConfig,
  metadata: block.metadata ?? {}
});

const serializePage = (
  doc: Record<string, unknown> & {
    blocks?: unknown[];
    seo?: Record<string, unknown>;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    published?: boolean;
  }
): PageConfig =>
  pageConfigSchema.parse({
    slug: String(doc.slug ?? ""),
    name: String(doc.name ?? ""),
    blocks: Array.isArray(doc.blocks)
      ? doc.blocks.map((block) =>
          serializeBlock(
            block as {
              id: string;
              type: string;
              order?: number;
              config: unknown;
              metadata?: Record<string, unknown>;
            }
          )
        )
      : [],
    seo: doc.seo ?? undefined,
    createdAt: new Date(doc.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(doc.updatedAt ?? Date.now()).toISOString(),
    published: doc.published ?? true
  });

const ensureDefaultHomepage = async () => {
  const existing = await PageModel.findOne({ slug: "home" }).lean<PageDocument | null>();
  if (existing) {
    return serializePage(existing);
  }

  const now = new Date();
  const created = await PageModel.create({
    slug: "home",
    name: "Homepage",
    blocks: resolveDefaultBlocks(),
    seo: {
      title: "VINC Trade Supply – Private Storefront",
      description:
        "Configure private storefronts for installers with curated plumbing, HVAC, and bathroom fixtures."
    },
    published: true,
    createdAt: now,
    updatedAt: now
  });

  return serializePage(created.toObject());
};

export const getPageConfig = async (slug: string): Promise<PageConfig | null> => {
  await connectToDatabase();

  if (slug === "home") {
    return ensureDefaultHomepage();
  }

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) {
    return null;
  }
  return serializePage(doc);
};

export const getAllPages = async (): Promise<PageConfig[]> => {
  await connectToDatabase();
  const docs = await PageModel.find({}).lean<PageDocument[]>();
  return docs.map(serializePage);
};

export const savePageConfig = async (input: PageConfigInput): Promise<PageConfig> => {
  const parsed = pageConfigSchema.parse({
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await connectToDatabase();

  const doc = await PageModel.findOneAndUpdate(
    { slug: parsed.slug },
    {
      name: parsed.name,
      blocks: parsed.blocks,
      seo: parsed.seo,
      published: parsed.published ?? true,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return serializePage(doc.toObject());
};
