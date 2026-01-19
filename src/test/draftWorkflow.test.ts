import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  savePage,
  publishPage,
  loadVersion,
  startNewVersion,
  getPageConfig
} from "@/lib/db/pages";
import type {
  PageBlock,
  HeroBlockConfig,
  PageConfig,
  PageVersion
} from "@/lib/types/blocks";

type MockPage = {
  slug: string;
  name: string;
  versions: PageVersion[];
  currentVersion: number;
  currentPublishedVersion?: number;
  createdAt: Date;
  updatedAt: Date;
};

const mockDb = new Map<string, MockPage>();

const createBasePage = (slug: string): MockPage => {
  const now = new Date();
  return {
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    versions: [],
    currentVersion: 0,
    currentPublishedVersion: undefined,
    createdAt: now,
    updatedAt: now,
  };
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

vi.mock("@/lib/db/connection", async () => {
  const mongoose = await import("mongoose");
  // Import the mocked PageModel from @/lib/db/models/page
  const { PageModel } = await import("@/lib/db/models/page");
  return {
    connectToDatabase: vi.fn().mockResolvedValue(undefined),
    connectWithModels: vi.fn(() => Promise.resolve({
      Page: PageModel,
      ...mongoose.default.models,
    })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
    autoDetectTenantDb: vi.fn(() => Promise.resolve("vinc-test-tenant")),
  };
});

vi.mock("@/lib/db/home-templates", () => ({
  getHomeTemplateConfig: vi.fn().mockRejectedValue(new Error("No template"))
}));

vi.mock("@/lib/db/models/page", () => {
  const PageModel = {
    findOne: ({ slug }: { slug: string }) => ({
      lean: async () => {
        const page = mockDb.get(slug);
        return page ? clone(page) : null;
      }
    }),
    findOneAndUpdate: async (
      query: { slug: string },
      update: Partial<MockPage>,
      options: { new?: boolean; upsert?: boolean } = {}
    ) => {
      let page = mockDb.get(query.slug);
      if (!page) {
        if (!options.upsert) {
          return null;
        }
        page = createBasePage(query.slug);
      }
      const next: MockPage = {
        ...page,
        ...update,
        versions: update.versions ?? page.versions,
        currentVersion: update.currentVersion ?? page.currentVersion,
        currentPublishedVersion:
          update.currentPublishedVersion ?? page.currentPublishedVersion,
        updatedAt: update.updatedAt ?? page.updatedAt,
        createdAt: page.createdAt,
        name: page.name ?? query.slug
      };
      mockDb.set(query.slug, next);
      return {
        toObject: () => clone(next)
      };
    },
    findOneAndDelete: async ({ slug }: { slug: string }) => {
      const exists = mockDb.has(slug);
      mockDb.delete(slug);
      return exists ? ({ toObject: () => null } as any) : null;
    },
    create: async (doc: Partial<MockPage>) => {
      const base = createBasePage(doc.slug ?? "page");
      const next: MockPage = {
        ...base,
        ...doc,
        versions: doc.versions ?? base.versions,
        currentVersion: doc.currentVersion ?? base.currentVersion,
        currentPublishedVersion: doc.currentPublishedVersion ?? base.currentPublishedVersion
      };
      mockDb.set(next.slug, next);
      return {
        toObject: () => clone(next)
      };
    }
  };
  return { PageModel };
});

const sampleHeroBlock: PageBlock = {
  id: "hero-1",
  type: "hero-full-width",
  order: 0,
  config: {
    variant: "fullWidth",
    title: "Welcome to <script>alert(1)</script> Store",
    subtitle: "Discover amazing <b>products</b>",
    cta: {
      text: "Shop <strong>Now</strong>",
      link: "/shop",
      style: "primary"
    },
    background: {
      type: "image",
      src: "https://example.com/hero.jpg",
      alt: "Hero image"
    },
    textAlign: "center",
    height: "medium",
    overlay: 0.4
  }
};

const secondHeroBlock = {
  ...sampleHeroBlock,
  id: "hero-2",
  config: {
    ...sampleHeroBlock.config,
    title: "Version Two Title",
    subtitle: "Updated subtitle content"
  }
};

describe("Draft workflow", () => {
  beforeEach(() => {
    mockDb.clear();
  });

  it("saves a draft with sanitized content", async () => {
    const result = await savePage({
      slug: "landing",
      blocks: [sampleHeroBlock],
      seo: { title: "Landing" }
    });

    expect(result.slug).toBe("landing");
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].status).toBe("draft");
    expect((result.versions[0].blocks[0].config as HeroBlockConfig).title).toBe("Welcome to  Store");
    expect(result.currentPublishedVersion).toBeUndefined();
    expect(mockDb.get("landing")?.versions).toHaveLength(1);
  });

  it("publishes draft and creates immutable versions", async () => {
    // Save first draft
    await savePage({ slug: "landing", blocks: [sampleHeroBlock], seo: { title: "Landing" } });

    // Publish first version
    const publishedV1 = await publishPage("landing");
    expect(publishedV1.currentPublishedVersion).toBe(1);
    expect(publishedV1.versions).toHaveLength(1);
    expect(publishedV1.versions[0].status).toBe("published");

    // Save second version (creates new draft since v1 is published)
    await savePage({
      slug: "landing",
      blocks: [secondHeroBlock]
    });

    // Publish second version
    const publishedV2 = await publishPage("landing");
    expect(publishedV2.currentPublishedVersion).toBe(2);
    expect(publishedV2.versions).toHaveLength(2);
    expect(
      (publishedV2.versions[1].blocks[0].config as HeroBlockConfig).title
    ).toBe("Version Two Title");
  });

  it("loads a published version as current", async () => {
    // Create and publish v1
    await savePage({ slug: "landing", blocks: [sampleHeroBlock] });
    await publishPage("landing");

    // Create and publish v2
    await savePage({ slug: "landing", blocks: [secondHeroBlock] });
    await publishPage("landing");

    // Load v1 as current
    const result = await loadVersion("landing", 1);
    expect(result.currentVersion).toBe(1);
    expect((result.versions[0].blocks[0].config as HeroBlockConfig).title).toBe("Welcome to  Store");
  });

  it("loads published version to view content", async () => {
    // Create and publish v1
    await savePage({ slug: "landing", blocks: [sampleHeroBlock] });
    await publishPage("landing");

    // Create and publish v2
    await savePage({ slug: "landing", blocks: [secondHeroBlock] });
    await publishPage("landing");

    // Load v2 to verify content
    const result = await loadVersion("landing", 2);
    expect(result.currentVersion).toBe(2);
    expect(
      (result.versions[1].blocks[0].config as HeroBlockConfig).title
    ).toBe("Version Two Title");
  });

  it("starts a new version from scratch", async () => {
    // Create and publish initial version
    await savePage({ slug: "landing", blocks: [sampleHeroBlock] });
    await publishPage("landing");

    // Start fresh version
    const fresh = await startNewVersion("landing");
    expect(fresh.versions).toHaveLength(2);
    expect(fresh.currentVersion).toBe(2);

    // New version has no blocks
    const newVersion = fresh.versions.find(v => v.version === 2);
    expect(newVersion?.blocks).toHaveLength(0);
  });

  it("returns default homepage when none exists", async () => {
    const home = await getPageConfig("home");
    expect(home.slug).toBe("home");
    expect(home.versions).toHaveLength(0);
    expect(home.name).toBe("Homepage");
  });
});
