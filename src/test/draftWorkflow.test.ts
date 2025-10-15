import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveDraft,
  publishDraft,
  loadVersionAsDraft,
  resetDraftToPublished,
  startNewDraft,
  getPageConfig
} from "@/lib/db/pages";
import type {
  DraftState,
  PublishedVersion,
  PageBlock,
  HeroBlockConfig
} from "@/lib/types/blocks";

type MockPage = {
  slug: string;
  name: string;
  draft: DraftState;
  publishedVersions: PublishedVersion[];
  currentPublishedVersion?: number;
  createdAt: Date;
  updatedAt: Date;
};

const mockDb = new Map<string, MockPage>();

const createBasePage = (slug: string): MockPage => {
  const now = new Date().toISOString();
  return {
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    draft: {
      blocks: [],
      seo: undefined,
      basedOnVersion: undefined,
      lastSavedAt: now,
      lastSavedBy: "system"
    },
    publishedVersions: [],
    currentPublishedVersion: undefined,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    blocks: [],
    published: true,
    status: "draft",
    currentVersion: 0,
    publishedVersion: undefined,
  };
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

vi.mock("@/lib/db/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined)
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
      const next = {
        ...page,
        ...update,
        draft: update.draft ?? page.draft,
        publishedVersions: update.publishedVersions ?? page.publishedVersions,
        currentPublishedVersion:
          update.currentPublishedVersion ?? page.currentPublishedVersion,
        updatedAt: update.updatedAt ?? page.updatedAt,
        createdAt: page.createdAt,
        name: page.name ?? query.slug
      } satisfies MockPage;
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
      const next = {
        ...base,
        ...doc,
        draft: doc.draft ?? base.draft,
        publishedVersions: doc.publishedVersions ?? base.publishedVersions
      } satisfies MockPage;
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
    const result = await saveDraft({
      slug: "landing",
      blocks: [sampleHeroBlock],
      seo: { title: "Landing" }
    });

    expect(result.slug).toBe("landing");
    expect(result.draft.blocks).toHaveLength(1);
    expect((result.draft.blocks[0].config as HeroBlockConfig).title).toBe("Welcome to alert(1) Store");
    expect(result.currentPublishedVersion).toBeUndefined();
    expect(mockDb.get("landing")?.draft?.blocks).toHaveLength(1);
  });

  it("publishes draft and creates immutable versions", async () => {
    await saveDraft({ slug: "landing", blocks: [sampleHeroBlock], seo: { title: "Landing" } });
    const publishedV1 = await publishDraft("landing", "Initial publish");

    expect(publishedV1.currentPublishedVersion).toBe(1);
    expect(publishedV1.publishedVersions).toHaveLength(1);
    expect(publishedV1.publishedVersions[0].comment).toBe("Initial publish");

    await saveDraft({
      slug: "landing",
      blocks: [secondHeroBlock],
      basedOnVersion: 1
    });
    const publishedV2 = await publishDraft("landing", "Second publish");

    expect(publishedV2.currentPublishedVersion).toBe(2);
    expect(publishedV2.publishedVersions).toHaveLength(2);
    expect(
      (publishedV2.publishedVersions[1].blocks[0].config as HeroBlockConfig).title
    ).toBe("Version Two Title");
  });

  it("loads a published version as draft", async () => {
    await saveDraft({ slug: "landing", blocks: [sampleHeroBlock] });
    await publishDraft("landing");
    await saveDraft({ slug: "landing", blocks: [secondHeroBlock], basedOnVersion: 1 });
    await publishDraft("landing");

    const result = await loadVersionAsDraft("landing", 1);
    expect(result.draft.basedOnVersion).toBe(1);
    expect((result.draft.blocks[0].config as HeroBlockConfig).title).toBe("Welcome to alert(1) Store");
  });

  it("resets draft to current published version", async () => {
    await saveDraft({ slug: "landing", blocks: [sampleHeroBlock] });
    await publishDraft("landing");
    await saveDraft({ slug: "landing", blocks: [secondHeroBlock], basedOnVersion: 1 });
    await publishDraft("landing");

    await saveDraft({
      slug: "landing",
      blocks: [
        {
          ...secondHeroBlock,
          config: { ...secondHeroBlock.config, title: "Draft changes" }
        }
      ],
      basedOnVersion: 2
    });

    const reset = await resetDraftToPublished("landing");
    expect(reset.draft.basedOnVersion).toBe(2);
    expect((reset.draft.blocks[0].config as HeroBlockConfig).title).toBe("Version Two Title");
  });

  it("starts a new draft from scratch", async () => {
    await saveDraft({ slug: "landing", blocks: [sampleHeroBlock] });
    await publishDraft("landing");

    const fresh = await startNewDraft("landing");
    expect(fresh.draft.blocks).toHaveLength(0);
    expect(fresh.draft.basedOnVersion).toBeUndefined();
  });

  it("returns default homepage when none exists", async () => {
    const home = await getPageConfig("home");
    expect(home.slug).toBe("home");
    expect(home.draft.blocks).toHaveLength(0);
    expect(home.name).toBe("Homepage");
  });
});
