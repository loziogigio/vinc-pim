/**
 * Integration Tests: Notification Templates API
 *
 * Tests for notification template CRUD operations.
 * Uses mongodb-memory-server for isolated database testing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  NotificationTemplateFactory,
} from "../conftest";
import { NotificationTemplateSchema } from "@/lib/db/models/notification-template";

describe("integration: Notification Templates", () => {
  let NotificationTemplate: mongoose.Model<mongoose.Document>;

  beforeAll(async () => {
    await setupTestDatabase();
    // Register the model directly on the test connection
    NotificationTemplate = mongoose.model("NotificationTemplate", NotificationTemplateSchema);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("Template CRUD Operations", () => {
    it("should create a template with valid data", async () => {
      /**
       * Test that a template can be created with valid data.
       * Note: template_id is normalized to lowercase by the schema.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();

      // Act
      const template = await NotificationTemplate.create(payload);

      // Assert
      expect(template.template_id).toBe(payload.template_id.toLowerCase());
      expect(template.name).toBe(payload.name);
      expect(template.trigger).toBe(payload.trigger);
    });

    it("should require template_id", async () => {
      /**
       * Test that template_id is required.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      delete (payload as Record<string, unknown>).template_id;

      // Act & Assert
      await expect(NotificationTemplate.create(payload)).rejects.toThrow();
    });

    it("should require name", async () => {
      /**
       * Test that name is required.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      delete (payload as Record<string, unknown>).name;

      // Act & Assert
      await expect(NotificationTemplate.create(payload)).rejects.toThrow();
    });

    it("should normalize template_id to lowercase", async () => {
      /**
       * Test that template_id is normalized to lowercase.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload({
        template_id: "MY-TEMPLATE-ID",
      });

      // Act
      const template = await NotificationTemplate.create(payload);

      // Assert
      expect(template.template_id).toBe("my-template-id");
    });

    it("should reject invalid template_id format", async () => {
      /**
       * Test that invalid template_id format is rejected.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload({
        template_id: "invalid id with spaces",
      });

      // Act & Assert
      await expect(NotificationTemplate.create(payload)).rejects.toThrow();
    });

    it("should reject duplicate template_id", async () => {
      /**
       * Test that duplicate template IDs are rejected.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload({
        template_id: "unique-template",
      });
      await NotificationTemplate.create(payload);

      // Act & Assert
      await expect(NotificationTemplate.create(payload)).rejects.toThrow();
    });

    it("should default is_active to true", async () => {
      /**
       * Test that is_active defaults to true.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      delete (payload as Record<string, unknown>).is_active;

      // Act
      const template = await NotificationTemplate.create(payload);

      // Assert
      expect(template.is_active).toBe(true);
    });

    it("should default is_default to false", async () => {
      /**
       * Test that is_default defaults to false.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      delete (payload as Record<string, unknown>).is_default;

      // Act
      const template = await NotificationTemplate.create(payload);

      // Assert
      expect(template.is_default).toBe(false);
    });

    it("should store email channel content", async () => {
      /**
       * Test that email channel content is properly stored.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload({
        channels: {
          email: {
            enabled: true,
            subject: "Test Subject",
            html_body: "<p>Test Body</p>",
            text_body: "Test Body",
          },
        },
      });

      // Act
      const template = await NotificationTemplate.create(payload);

      // Assert
      expect(template.channels?.email?.enabled).toBe(true);
      expect(template.channels?.email?.subject).toBe("Test Subject");
      expect(template.channels?.email?.html_body).toBe("<p>Test Body</p>");
    });

    it("should store variables array", async () => {
      /**
       * Test that variables array is properly stored.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload({
        variables: ["name", "email", "order_id"],
      });

      // Act
      const template = await NotificationTemplate.create(payload);

      // Assert
      expect(template.variables).toHaveLength(3);
      expect(template.variables).toContain("name");
      expect(template.variables).toContain("email");
      expect(template.variables).toContain("order_id");
    });

    it("should update template fields", async () => {
      /**
       * Test that template fields can be updated.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      const template = await NotificationTemplate.create(payload);

      // Act
      const updated = await NotificationTemplate.findByIdAndUpdate(
        template._id,
        { name: "Updated Name", is_active: false },
        { new: true }
      );

      // Assert
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.is_active).toBe(false);
    });

    it("should delete template", async () => {
      /**
       * Test that template can be deleted.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      const template = await NotificationTemplate.create(payload);

      // Act
      await NotificationTemplate.findByIdAndDelete(template._id);
      const deleted = await NotificationTemplate.findById(template._id);

      // Assert
      expect(deleted).toBeNull();
    });
  });

  describe("Template Queries", () => {
    it("should find templates by trigger", async () => {
      /**
       * Test finding templates by trigger type.
       */
      // Arrange
      await NotificationTemplate.create(
        NotificationTemplateFactory.createWelcomeTemplate()
      );
      await NotificationTemplate.create(
        NotificationTemplateFactory.createOrderTemplate()
      );

      // Act
      const welcomeTemplates = await NotificationTemplate.find({ trigger: "welcome" });
      const orderTemplates = await NotificationTemplate.find({ trigger: "order_confirmation" });

      // Assert
      expect(welcomeTemplates).toHaveLength(1);
      expect(orderTemplates).toHaveLength(1);
    });

    it("should find active templates only", async () => {
      /**
       * Test finding only active templates.
       */
      // Arrange
      await NotificationTemplate.create(
        NotificationTemplateFactory.createPayload({ is_active: true })
      );
      await NotificationTemplate.create(
        NotificationTemplateFactory.createInactiveTemplate()
      );

      // Act
      const activeTemplates = await NotificationTemplate.find({ is_active: true });

      // Assert
      expect(activeTemplates).toHaveLength(1);
    });

    it("should find default templates", async () => {
      /**
       * Test finding default templates.
       */
      // Arrange
      await NotificationTemplate.create(
        NotificationTemplateFactory.createWelcomeTemplate({ is_default: true })
      );
      await NotificationTemplate.create(
        NotificationTemplateFactory.createPayload({ is_default: false })
      );

      // Act
      const defaultTemplates = await NotificationTemplate.find({ is_default: true });

      // Assert
      expect(defaultTemplates).toHaveLength(1);
    });

    it("should search templates by name", async () => {
      /**
       * Test searching templates by name.
       */
      // Arrange
      await NotificationTemplate.create(
        NotificationTemplateFactory.createPayload({ name: "Welcome Email Template" })
      );
      await NotificationTemplate.create(
        NotificationTemplateFactory.createPayload({ name: "Order Confirmation" })
      );

      // Act
      const searchResults = await NotificationTemplate.find({
        name: { $regex: "Welcome", $options: "i" },
      });

      // Assert
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toContain("Welcome");
    });
  });

  describe("Template Timestamps", () => {
    it("should set created_at on creation", async () => {
      /**
       * Test that created_at is set on template creation.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      const before = new Date();

      // Act
      const template = await NotificationTemplate.create(payload);
      const after = new Date();

      // Assert
      expect(template.created_at).toBeDefined();
      expect(new Date(template.created_at).getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(new Date(template.created_at).getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should update updated_at on modification", async () => {
      /**
       * Test that updated_at is set on template update.
       */
      // Arrange
      const payload = NotificationTemplateFactory.createPayload();
      const template = await NotificationTemplate.create(payload);
      const originalUpdatedAt = template.updated_at;

      // Small delay to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act
      const updated = await NotificationTemplate.findByIdAndUpdate(
        template._id,
        { name: "Updated Name" },
        { new: true }
      );

      // Assert
      expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });
});
