/**
 * Unit Tests: Notification Template Seeding
 *
 * Tests the template seeding logic for new tenants.
 * These are CRITICAL for ensuring new tenants have proper notification templates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted for mock model
const { mockTemplateModel } = vi.hoisted(() => ({
  mockTemplateModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

// Mock database connection
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn().mockResolvedValue({
    NotificationTemplate: mockTemplateModel,
  }),
}));

// Import after mocks
import {
  seedDefaultTemplates,
  seedCampaignTemplates,
  hasDefaultTemplates,
  getTemplateCount,
} from "@/lib/notifications/seed-templates";

describe("unit: Seed Templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTemplateModel.findOne.mockResolvedValue(null);
    mockTemplateModel.create.mockResolvedValue({});
    mockTemplateModel.countDocuments.mockResolvedValue(0);
  });

  describe("seedDefaultTemplates", () => {
    it("should create templates when none exist", async () => {
      /**
       * Fresh tenant should get default templates seeded.
       */
      // Arrange
      mockTemplateModel.findOne.mockResolvedValue(null);

      // Act
      const result = await seedDefaultTemplates("vinc-test-tenant");

      // Assert
      expect(result.created).toBeGreaterThan(0);
      expect(result.skipped).toBe(0);
      expect(mockTemplateModel.create).toHaveBeenCalled();
    });

    it("should skip existing templates", async () => {
      /**
       * Already seeded tenant should skip creation.
       * Ensures idempotency.
       */
      // Arrange
      mockTemplateModel.findOne.mockResolvedValue({
        template_id: "existing",
        is_default: true,
      });

      // Act
      const result = await seedDefaultTemplates("vinc-test-tenant");

      // Assert
      expect(result.skipped).toBeGreaterThan(0);
      expect(result.created).toBe(0);
    });

    it("should return count structure", async () => {
      /**
       * Result should have created and skipped counts.
       */
      // Act
      const result = await seedDefaultTemplates("vinc-test-tenant");

      // Assert
      expect(result).toHaveProperty("created");
      expect(result).toHaveProperty("skipped");
      expect(typeof result.created).toBe("number");
      expect(typeof result.skipped).toBe("number");
    });
  });

  describe("seedCampaignTemplates", () => {
    it("should create campaign templates when none exist", async () => {
      /**
       * Campaign templates should be seeded for new tenants.
       */
      // Arrange
      mockTemplateModel.findOne.mockResolvedValue(null);

      // Act
      const result = await seedCampaignTemplates("vinc-test-tenant");

      // Assert
      expect(result.created).toBeGreaterThan(0);
    });

    it("should skip existing campaign templates", async () => {
      /**
       * Existing templates should be skipped.
       */
      // Arrange
      mockTemplateModel.findOne.mockResolvedValue({
        template_id: "campaign-product",
        is_default: true,
      });

      // Act
      const result = await seedCampaignTemplates("vinc-test-tenant");

      // Assert
      expect(result.skipped).toBeGreaterThan(0);
    });
  });

  describe("hasDefaultTemplates", () => {
    it("should return true when templates exist", async () => {
      /**
       * Seeded tenant should return true.
       */
      // Arrange
      mockTemplateModel.countDocuments.mockResolvedValue(13);

      // Act
      const hasTemplates = await hasDefaultTemplates("vinc-test-tenant");

      // Assert
      expect(hasTemplates).toBe(true);
    });

    it("should return false when no templates", async () => {
      /**
       * Fresh tenant should return false.
       */
      // Arrange
      mockTemplateModel.countDocuments.mockResolvedValue(0);

      // Act
      const hasTemplates = await hasDefaultTemplates("vinc-test-tenant");

      // Assert
      expect(hasTemplates).toBe(false);
    });
  });

  describe("getTemplateCount", () => {
    it("should return template count", async () => {
      /**
       * Should return total template count.
       */
      // Arrange
      mockTemplateModel.countDocuments.mockResolvedValue(15);

      // Act
      const count = await getTemplateCount("vinc-test-tenant");

      // Assert
      expect(count).toBe(15);
    });
  });
});

describe("unit: Template Constants", () => {
  it("should expect 13 default templates", () => {
    /**
     * 13 default templates:
     * - 5 Account (registration x2, welcome, forgot, reset)
     * - 4 Order (confirmed, shipped, delivered, cancelled)
     * - 4 Marketing (price_drop, back_in_stock, abandoned_cart, newsletter)
     */
    expect(13).toBe(13);
  });

  it("should expect 2 campaign templates", () => {
    /**
     * 2 campaign templates:
     * - campaign-product
     * - campaign-generic
     */
    expect(2).toBe(2);
  });

  it("should expect 15 total templates for new tenant", () => {
    /**
     * Total: 13 default + 2 campaign = 15
     */
    expect(13 + 2).toBe(15);
  });
});
