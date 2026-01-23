import { connectWithModels, autoDetectTenantDb } from "./connection";
import type { HomeTemplateDocument } from "./models/home-template";
import type mongoose from "mongoose";

const HOME_TEMPLATE_ID = "home-page";

/**
 * Get the HomeTemplate model for the current tenant database
 * Uses auto-detection from headers/session if tenantDb not provided
 */
async function getHomeTemplateModel(tenantDb?: string): Promise<mongoose.Model<HomeTemplateDocument>> {
  const dbName = tenantDb ?? await autoDetectTenantDb();
  const models = await connectWithModels(dbName);
  return models.HomeTemplate as mongoose.Model<HomeTemplateDocument>;
}

/**
 * Initialize empty home template without any default blocks
 * The B2B admin should manually create blocks in the builder
 * New structure: Creates a single document (version 1)
 */
export async function initializeHomeTemplate(tenantDb?: string) {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  // Check if template already exists (any version)
  const existing = await HomeTemplateModel.findOne({ templateId: HOME_TEMPLATE_ID });

  if (existing) {
    console.log("[initializeHomeTemplate] Home template already exists, skipping initialization");
    return existing;
  }

  console.log("[initializeHomeTemplate] Creating empty home template - no default blocks");

  const now = new Date().toISOString();

  try {
    // Create empty initial version as a single document
    const template = await HomeTemplateModel.create({
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
  } catch (error: unknown) {
    // Handle race condition - if duplicate key error, return existing document
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      console.log("[initializeHomeTemplate] Race condition detected, returning existing template");
      const existingTemplate = await HomeTemplateModel.findOne({ templateId: HOME_TEMPLATE_ID });
      if (existingTemplate) {
        return existingTemplate;
      }
    }
    throw error;
  }
}
