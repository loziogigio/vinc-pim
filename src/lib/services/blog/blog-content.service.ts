// src/lib/services/blog/blog-content.service.ts
/**
 * Blog content & version service.
 *
 * Mirrors the b2b-home-template versioning model (flat per-version docs +
 * is_current / is_current_published flags) but scoped by (post_id, locale),
 * and keeps the BlogPost.translations[locale] meta in sync after every change.
 *
 * Returns a PageConfig-compatible shape so the existing page-builder store
 * (loadPageConfig / getPagePayload) can drive the blog editor unchanged.
 */
import { connectWithModels } from "@/lib/db/connection";

export interface BlogContentConfig {
  slug: string;
  name: string;
  versions: Array<Record<string, unknown>>;
  currentVersion: number;
  currentPublishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

const CREATED_BY = "b2b-admin";

function sanitizeBlocks(blocks: unknown[]): unknown[] {
  return (blocks as any[]).map((block, index) => ({
    id: block.id || `block-${index}`,
    type: block.type,
    order: index,
    config: block.config || {},
    metadata: block.metadata || {},
    ...(block.layout !== undefined && { layout: block.layout }),
    ...(block.zone !== undefined && { zone: block.zone }),
    ...(block.tabLabel !== undefined && { tabLabel: block.tabLabel }),
    ...(block.tabIcon !== undefined && { tabIcon: block.tabIcon }),
    ...(block.showTitle !== undefined && { showTitle: block.showTitle }),
    ...(block.titleAlignment !== undefined && { titleAlignment: block.titleAlignment }),
  }));
}

async function updateBlogCurrentPublishedFlags(
  tenantDb: string,
  postId: string,
  locale: string,
): Promise<void> {
  const { BlogPostVersion } = await connectWithModels(tenantDb);
  await BlogPostVersion.updateMany(
    { post_id: postId, locale },
    { $set: { is_current_published: false } },
  );
  const published = await BlogPostVersion.find({ post_id: postId, locale, status: "published" })
    .sort({ version: -1 })
    .lean();
  if (published.length > 0) {
    await BlogPostVersion.updateOne(
      { post_id: postId, locale, version: (published[0] as any).version },
      { $set: { is_current_published: true } },
    );
  }
}

async function syncTranslationMeta(
  tenantDb: string,
  postId: string,
  locale: string,
): Promise<void> {
  const { BlogPost, BlogPostVersion } = await connectWithModels(tenantDb);
  const current: any = await BlogPostVersion.findOne({ post_id: postId, locale, is_current: true }).lean();
  const published: any = await BlogPostVersion.findOne({ post_id: postId, locale, is_current_published: true }).lean();
  const post: any = await BlogPost.findOne({ post_id: postId }).lean();
  const tr = post?.translations?.find((t: any) => t.locale === locale);
  const scheduledAt = tr?.scheduled_at ? new Date(tr.scheduled_at).getTime() : 0;

  let status: "draft" | "scheduled" | "published" = "draft";
  if (published) status = "published";
  else if (scheduledAt > Date.now()) status = "scheduled";

  const set: Record<string, unknown> = {
    "translations.$.current_version": current?.version ?? 1,
    "translations.$.status": status,
  };
  if (published) {
    set["translations.$.published_version"] = published.version;
    if (published.published_at) set["translations.$.published_at"] = new Date(published.published_at);
  }
  await BlogPost.updateOne({ post_id: postId, "translations.locale": locale }, { $set: set });
}

export async function getBlogContent(
  tenantDb: string,
  postId: string,
  locale: string,
): Promise<BlogContentConfig> {
  const { BlogPostVersion } = await connectWithModels(tenantDb);
  const docs: any[] = await BlogPostVersion.find({ post_id: postId, locale }).sort({ version: 1 }).lean();
  const now = new Date().toISOString();

  if (docs.length === 0) {
    return {
      slug: `${postId}:${locale}`, name: postId, versions: [],
      currentVersion: 0, currentPublishedVersion: null, createdAt: now, updatedAt: now,
    };
  }

  const current = docs.find((d) => d.is_current);
  const currentPublished = docs.find((d) => d.is_current_published);
  const versions = docs.map((v) => ({
    version: v.version,
    blocks: v.blocks || [],
    seo: v.seo || {},
    status: v.status,
    label: v.label ?? v.comment ?? `Version ${v.version}`,
    createdAt: v.created_at,
    lastSavedAt: v.created_at,
    publishedAt: v.published_at,
    createdBy: v.created_by,
    comment: v.comment,
  }));

  return {
    slug: `${postId}:${locale}`,
    name: postId,
    versions,
    currentVersion: current?.version ?? docs[docs.length - 1].version,
    currentPublishedVersion: currentPublished?.version ?? null,
    createdAt: docs[0].created_at,
    updatedAt: docs[docs.length - 1].created_at,
  };
}

export async function saveBlogContentDraft(
  tenantDb: string,
  postId: string,
  locale: string,
  payload: { blocks: unknown[]; seo?: unknown },
): Promise<BlogContentConfig> {
  const { BlogPostVersion } = await connectWithModels(tenantDb);
  const blocks = sanitizeBlocks(payload.blocks);
  const seo = payload.seo || {};
  const now = new Date().toISOString();

  let current: any = await BlogPostVersion.findOne({ post_id: postId, locale, is_current: true });

  if (!current) {
    const all: any[] = await BlogPostVersion.find({ post_id: postId, locale }).sort({ version: 1 }).lean();
    if (all.length === 0) {
      await BlogPostVersion.create({
        post_id: postId, locale, version: 1, blocks, seo, status: "draft",
        label: "Version 1", created_at: now, created_by: CREATED_BY, comment: "Version 1", is_current: true,
      });
      await syncTranslationMeta(tenantDb, postId, locale);
      return getBlogContent(tenantDb, postId, locale);
    }
    const latest = all[all.length - 1];
    await BlogPostVersion.updateOne({ post_id: postId, locale, version: latest.version }, { $set: { is_current: true } });
    current = await BlogPostVersion.findOne({ post_id: postId, locale, version: latest.version });
  }

  if (current.status === "published") {
    const all: any[] = await BlogPostVersion.find({ post_id: postId, locale }).lean();
    const nextVersion = Math.max(...all.map((v) => v.version)) + 1;
    await BlogPostVersion.updateMany({ post_id: postId, locale }, { $set: { is_current: false } });
    await BlogPostVersion.create({
      post_id: postId, locale, version: nextVersion, blocks, seo, status: "draft",
      label: `Version ${nextVersion}`, created_at: now, created_by: CREATED_BY,
      comment: `Version ${nextVersion}`, is_current: true,
    });
  } else {
    await BlogPostVersion.updateOne(
      { post_id: postId, locale, version: current.version },
      { $set: { blocks, seo } },
    );
  }

  await syncTranslationMeta(tenantDb, postId, locale);
  return getBlogContent(tenantDb, postId, locale);
}

export async function publishBlogContent(
  tenantDb: string,
  postId: string,
  locale: string,
): Promise<BlogContentConfig> {
  const { BlogPost, BlogPostVersion } = await connectWithModels(tenantDb);
  const current: any = await BlogPostVersion.findOne({ post_id: postId, locale, is_current: true });
  if (!current) throw new Error("No current version to publish");

  const now = new Date().toISOString();
  await BlogPostVersion.updateOne(
    { post_id: postId, locale, version: current.version },
    { $set: { status: "published", published_at: now } },
  );
  await updateBlogCurrentPublishedFlags(tenantDb, postId, locale);

  await BlogPost.updateOne(
    { post_id: postId, "translations.locale": locale },
    { $unset: { "translations.$.scheduled_at": "" } },
  );
  await syncTranslationMeta(tenantDb, postId, locale);
  return getBlogContent(tenantDb, postId, locale);
}

export async function loadBlogContentVersion(
  tenantDb: string,
  postId: string,
  locale: string,
  version: number,
): Promise<BlogContentConfig> {
  const { BlogPostVersion } = await connectWithModels(tenantDb);
  const target = await BlogPostVersion.findOne({ post_id: postId, locale, version }).lean();
  if (!target) throw new Error(`Version ${version} not found`);
  await BlogPostVersion.updateMany({ post_id: postId, locale }, { $set: { is_current: false } });
  await BlogPostVersion.updateOne({ post_id: postId, locale, version }, { $set: { is_current: true } });
  await syncTranslationMeta(tenantDb, postId, locale);
  return getBlogContent(tenantDb, postId, locale);
}

export async function deleteBlogContentVersion(
  tenantDb: string,
  postId: string,
  locale: string,
  version: number,
): Promise<BlogContentConfig> {
  const { BlogPostVersion } = await connectWithModels(tenantDb);
  const target: any = await BlogPostVersion.findOne({ post_id: postId, locale, version });
  if (!target) throw new Error(`Version ${version} not found`);
  if (target.is_current) throw new Error("Cannot delete the current version");
  if (target.is_current_published) throw new Error("Cannot delete the published version");
  await BlogPostVersion.deleteOne({ _id: target._id });
  await updateBlogCurrentPublishedFlags(tenantDb, postId, locale);
  await syncTranslationMeta(tenantDb, postId, locale);
  return getBlogContent(tenantDb, postId, locale);
}

export async function duplicateBlogContentVersion(
  tenantDb: string,
  postId: string,
  locale: string,
  sourceVersion: number,
): Promise<BlogContentConfig> {
  const { BlogPostVersion } = await connectWithModels(tenantDb);
  const source: any = await BlogPostVersion.findOne({ post_id: postId, locale, version: sourceVersion }).lean();
  if (!source) throw new Error(`Source version ${sourceVersion} not found`);
  const all: any[] = await BlogPostVersion.find({ post_id: postId, locale }).lean();
  const nextVersion = Math.max(...all.map((v) => v.version)) + 1;
  const now = new Date().toISOString();
  await BlogPostVersion.updateMany({ post_id: postId, locale }, { $set: { is_current: false } });
  await BlogPostVersion.create({
    post_id: postId, locale, version: nextVersion,
    blocks: JSON.parse(JSON.stringify(source.blocks || [])),
    seo: source.seo ? JSON.parse(JSON.stringify(source.seo)) : {},
    status: "draft",
    label: source.label ? `${source.label} (Copy)` : `Version ${nextVersion}`,
    created_at: now, created_by: source.created_by || CREATED_BY,
    comment: `Version ${nextVersion} (duplicated from v${sourceVersion})`,
    is_current: true,
  });
  await syncTranslationMeta(tenantDb, postId, locale);
  return getBlogContent(tenantDb, postId, locale);
}
