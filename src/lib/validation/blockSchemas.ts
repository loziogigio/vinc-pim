import { z } from "zod";

export const heroCTA = z.object({
  text: z.string().min(1),
  link: z.string().min(1),
  style: z.enum(["primary", "secondary", "outline"]).optional()
});

const heroFullWidthSchema = z.object({
  variant: z.literal("fullWidth"),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  cta: heroCTA.optional(),
  background: z.object({
    type: z.literal("image"),
    src: z.string().url(),
    alt: z.string().min(1)
  }),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
  height: z.enum(["small", "medium", "large"]).default("medium"),
  overlay: z.number().min(0).max(1).optional()
});

const heroSplitSchema = z.object({
  variant: z.literal("split"),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  cta: heroCTA.optional(),
  image: z.string().url(),
  imagePosition: z.enum(["left", "right"]).default("right"),
  backgroundColor: z.string().optional()
});

const heroCarouselSchema = z.object({
  variant: z.literal("carousel"),
  slides: z
    .array(
      z.object({
        title: z.string().min(1),
        subtitle: z.string().optional(),
        cta: heroCTA.optional(),
        image: z.string().url()
      })
    )
    .min(1),
  autoplay: z.boolean().optional(),
  interval: z.number().int().min(1000).max(30000).optional(),
  showDots: z.boolean().optional(),
  showArrows: z.boolean().optional()
});

export const heroBlockSchema = z.discriminatedUnion("variant", [
  heroFullWidthSchema,
  heroSplitSchema,
  heroCarouselSchema
]);

const productColumnsSchema = z.object({
  mobile: z.number().min(1),
  tablet: z.number().min(1),
  desktop: z.number().min(1)
});

const productSliderSchema = z.object({
  variant: z.literal("slider"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  collection: z.string().min(1),
  limit: z.number().min(1),
  columns: productColumnsSchema,
  showBadges: z.boolean().optional(),
  showQuickAdd: z.boolean().optional(),
  slidesPerView: z.number().min(1),
  spaceBetween: z.number().min(0)
});

const productGridSchema = z.object({
  variant: z.literal("grid"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  collection: z.string().min(1),
  limit: z.number().min(1),
  columns: productColumnsSchema,
  showFilters: z.boolean().optional(),
  showSort: z.boolean().optional(),
  pagination: z.enum(["none", "pager", "infinite-scroll"]).optional()
});

export const productBlockSchema = z.discriminatedUnion("variant", [
  productSliderSchema,
  productGridSchema
]);

const categoryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  image: z.string().url().optional(),
  link: z.string().optional(),
  productCount: z.number().int().nonnegative().optional()
});

const categoryGridSchema = z.object({
  variant: z.literal("grid"),
  title: z.string().optional(),
  categories: z.array(categoryItemSchema),
  layout: z.enum(["grid", "masonry"]).default("grid"),
  columns: productColumnsSchema,
  showImage: z.boolean().optional(),
  showCount: z.boolean().optional(),
  imageAspectRatio: z.enum(["1:1", "4:3", "3:2", "16:9"]).optional()
});

const categoryCarouselSchema = z.object({
  variant: z.literal("carousel"),
  title: z.string().optional(),
  categories: z.array(categoryItemSchema),
  slidesPerView: z.number().min(1).default(4),
  showImage: z.boolean().optional()
});

export const categoryBlockSchema = z.discriminatedUnion("variant", [
  categoryGridSchema,
  categoryCarouselSchema
]);

const contentRichTextSchema = z.object({
  variant: z.literal("richText"),
  content: z.string().min(1),
  width: z.enum(["full", "contained"]).default("contained"),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
  padding: z.enum(["none", "small", "medium", "large"]).default("medium")
});

const contentFeaturesSchema = z.object({
  variant: z.literal("features"),
  title: z.string().optional(),
  features: z
    .array(
      z.object({
        icon: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional()
      })
    )
    .min(1),
  columns: productColumnsSchema
});

const contentTestimonialsSchema = z.object({
  variant: z.literal("testimonials"),
  title: z.string().optional(),
  testimonials: z
    .array(
      z.object({
        quote: z.string().min(1),
        author: z.string().min(1),
        role: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        rating: z.number().min(1).max(5).optional()
      })
    )
    .min(1),
  layout: z.enum(["carousel", "grid"]).default("carousel"),
  showRating: z.boolean().optional(),
  showAvatar: z.boolean().optional()
});

export const contentBlockSchema = z.discriminatedUnion("variant", [
  contentRichTextSchema,
  contentFeaturesSchema,
  contentTestimonialsSchema
]);

export const blockConfigSchema = z.union([
  heroBlockSchema,
  productBlockSchema,
  categoryBlockSchema,
  contentBlockSchema
]);

export const pageBlockSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  order: z.number().int().nonnegative(),
  config: blockConfigSchema,
  metadata: z.record(z.string(), z.any()).optional()
});

export const seoSettingsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  image: z.string().url().optional()
});

const pageVersionSchema = z.object({
  version: z.number(),
  blocks: z.array(pageBlockSchema),
  seo: seoSettingsSchema.optional(),
  status: z.enum(["draft", "published"]),
  createdAt: z.string(),
  lastSavedAt: z.string(),
  publishedAt: z.string().optional(),
  createdBy: z.string().optional(),
  comment: z.string().optional()
});

export const pageConfigSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  versions: z.array(pageVersionSchema).default([]),
  currentVersion: z.number().default(0),
  currentPublishedVersion: z.number().optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
  // Deprecated fields (for backwards compatibility)
  blocks: z.array(pageBlockSchema).optional(),
  seo: seoSettingsSchema.optional(),
  published: z.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
  publishedVersion: z.number().optional(),
  draft: z.object({
    blocks: z.array(pageBlockSchema),
    seo: seoSettingsSchema.optional(),
    basedOnVersion: z.number().optional(),
    lastSavedAt: z.string(),
    lastSavedBy: z.string().optional()
  }).optional(),
  publishedVersions: z.array(pageVersionSchema).optional()
});

export type PageConfigInput = z.infer<typeof pageConfigSchema>;
