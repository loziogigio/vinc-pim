import createDOMPurify from "dompurify";
import type { Config as DOMPurifyConfig } from "dompurify";
import { JSDOM } from "jsdom";
import type {
  PageBlock,
  HeroBlockConfig,
  ProductBlockConfig,
  CategoryBlockConfig,
  ContentBlockConfig
} from "@/lib/types/blocks";

const window = new JSDOM("").window as unknown as Window & typeof globalThis;
const DOMPurify = createDOMPurify(window);

const sanitizeText = (value: string) =>
  DOMPurify.sanitize(value, { ALLOWED_TAGS: [] as string[], ALLOWED_ATTR: [] as string[] }).trim();

const RICH_TEXT_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    "p",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "br",
    "span",
    "a",
    "h1",
    "h2",
    "h3",
    "blockquote"
  ],
  ALLOWED_ATTR: ["href", "title", "target", "rel"],
  FORBID_ATTR: ["style"],
  RETURN_TRUSTED_TYPE: false
};

const sanitizeRichText = (value: string) => DOMPurify.sanitize(value, RICH_TEXT_CONFIG);

export const sanitizeBlock = (block: PageBlock): PageBlock => {
  console.log('[sanitizeBlock] Processing block type:', block.type, 'config:', block.config);

  // For legacy block types with specific sanitization rules
  if (block.type.startsWith("hero")) {
    return sanitizeHeroBlock(block);
  }
  if (block.type.startsWith("product") && !block.type.includes("Info") && !block.type.includes("Suggestions")) {
    return sanitizeProductBlock(block);
  }
  if (block.type.startsWith("category")) {
    return sanitizeCategoryBlock(block);
  }
  if (block.type.startsWith("content")) {
    return sanitizeContentBlock(block);
  }

  // For all other block types (youtubeEmbed, richText, customHTML, spacer, productInfo, productSuggestions, etc.)
  // Return the block as-is to preserve the full config
  console.log('[sanitizeBlock] Returning block as-is (no specific sanitization)');
  return block;
};

const sanitizeHeroBlock = (block: PageBlock): PageBlock => {
  const config = block.config as HeroBlockConfig;

  switch (config.variant) {
    case "fullWidth":
      return {
        ...block,
        config: {
          ...config,
          title: sanitizeText(config.title),
          subtitle: config.subtitle ? sanitizeText(config.subtitle) : config.subtitle,
          cta: config.cta
            ? { ...config.cta, text: sanitizeText(config.cta.text), link: config.cta.link }
            : config.cta
        }
      };
    case "split":
      return {
        ...block,
        config: {
          ...config,
          title: sanitizeText(config.title),
          subtitle: config.subtitle ? sanitizeText(config.subtitle) : config.subtitle,
          cta: config.cta
            ? { ...config.cta, text: sanitizeText(config.cta.text), link: config.cta.link }
            : config.cta
        }
      };
    case "carousel":
      return {
        ...block,
        config: {
          ...config,
          slides: config.slides.map((slide) => ({
            ...slide,
            title: sanitizeText(slide.title),
            subtitle: slide.subtitle ? sanitizeText(slide.subtitle) : slide.subtitle
          }))
        }
      };
    default:
      return block;
  }
};

const sanitizeProductBlock = (block: PageBlock): PageBlock => {
  const config = block.config as ProductBlockConfig;

  return {
    ...block,
    config: {
      ...config,
      title: config.title ? sanitizeText(config.title) : config.title,
      subtitle: config.subtitle ? sanitizeText(config.subtitle) : config.subtitle
    }
  };
};

const sanitizeCategoryBlock = (block: PageBlock): PageBlock => {
  const config = block.config as CategoryBlockConfig;
  return {
    ...block,
    config: {
      ...config,
      title: config.title ? sanitizeText(config.title) : config.title,
      categories: config.categories.map((category) => ({
        ...category,
        name: sanitizeText(category.name)
      }))
    }
  };
};

const sanitizeContentBlock = (block: PageBlock): PageBlock => {
  const config = block.config as ContentBlockConfig;

  switch (config.variant) {
    case "richText":
      return {
        ...block,
        config: {
          ...config,
          content: sanitizeRichText(config.content)
        }
      };
    case "features":
      return {
        ...block,
        config: {
          ...config,
          title: config.title ? sanitizeText(config.title) : config.title,
          features: config.features.map((feature) => ({
            ...feature,
            icon: feature.icon ? sanitizeText(feature.icon) : feature.icon,
            title: sanitizeText(feature.title),
            description: feature.description ? sanitizeText(feature.description) : feature.description
          }))
        }
      };
    case "testimonials":
      return {
        ...block,
        config: {
          ...config,
          title: config.title ? sanitizeText(config.title) : config.title,
          testimonials: config.testimonials.map((testimonial) => ({
            ...testimonial,
            quote: sanitizeText(testimonial.quote),
            author: sanitizeText(testimonial.author),
            role: testimonial.role ? sanitizeText(testimonial.role) : testimonial.role
          }))
        }
      };
    default:
      return block;
  }
};

export const sanitizeBlocks = (blocks: PageBlock[]) => blocks.map((block) => sanitizeBlock(block));
