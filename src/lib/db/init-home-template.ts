import { connectToDatabase } from "./connection";
import { B2BHomeTemplateModel } from "./models/home-template";

const HOME_TEMPLATE_ID = "home-page";

/**
 * Initialize empty home template without any default blocks
 * The B2B admin should manually create blocks in the builder
 * New structure: Creates a single document (version 1)
 */
export async function initializeHomeTemplate() {
  await connectToDatabase();

  // Check if template already exists (any version)
  const existing = await B2BHomeTemplateModel.findOne({ templateId: HOME_TEMPLATE_ID });

  if (existing) {
    console.log("[initializeHomeTemplate] Home template already exists, skipping initialization");
    return existing;
  }

  console.log("[initializeHomeTemplate] Creating empty home template - no default blocks");

  const now = new Date().toISOString();

  // Create empty initial version as a single document
  const template = await B2BHomeTemplateModel.create({
    templateId: HOME_TEMPLATE_ID,
    name: "Home Page",
    version: 1,
    blocks: [], // Empty - no auto-population
    seo: {},
    status: "draft" as const,
    label: "Version 1",
    createdAt: now,
    lastSavedAt: now,
    createdBy: "system",
    comment: "Empty home page template - ready for customization",
    isCurrent: true, // Mark as current working version
    isActive: true
  });

  console.log("[initializeHomeTemplate] Empty home template created successfully");
  return template;
}
