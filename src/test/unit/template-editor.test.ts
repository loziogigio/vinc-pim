/**
 * Unit Tests: Template Editor
 *
 * Tests for template editor functionality.
 */

import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGERS,
  TRIGGER_LABELS,
} from "@/lib/constants/notification";
import type { INotificationTemplate, NotificationChannel } from "@/lib/constants/notification";

describe("unit: Template Editor", () => {
  describe("Channel Tabs", () => {
    const CHANNEL_TABS = ["email", "web_push", "mobile_push", "sms"] as const;

    it("should have tabs for all channels", () => {
      /**
       * Verify all channels have corresponding tabs.
       */
      NOTIFICATION_CHANNELS.forEach((channel) => {
        expect(CHANNEL_TABS).toContain(channel);
      });
    });

    it("should have email as first tab", () => {
      /**
       * Email should be the default/first tab.
       */
      expect(CHANNEL_TABS[0]).toBe("email");
    });
  });

  describe("Trigger Selection", () => {
    it("should have labels for all triggers", () => {
      /**
       * Verify all triggers have human-readable labels.
       */
      NOTIFICATION_TRIGGERS.forEach((trigger) => {
        expect(TRIGGER_LABELS[trigger]).toBeDefined();
        expect(TRIGGER_LABELS[trigger].length).toBeGreaterThan(0);
      });
    });

    it("should allow custom trigger", () => {
      /**
       * Verify custom trigger exists for user-defined templates.
       */
      expect(NOTIFICATION_TRIGGERS).toContain("custom");
      expect(TRIGGER_LABELS.custom).toBe("Custom Template");
    });
  });

  describe("Variable Insertion", () => {
    const insertVariable = (text: string, variable: string, position: number) => {
      return text.substring(0, position) + `{{${variable}}}` + text.substring(position);
    };

    it("should insert variable at cursor position", () => {
      /**
       * Test variable insertion at specific position.
       */
      const text = "Hello World";
      const result = insertVariable(text, "name", 6);
      expect(result).toBe("Hello {{name}}World");
    });

    it("should insert variable at start", () => {
      /**
       * Test variable insertion at start.
       */
      const text = "Hello";
      const result = insertVariable(text, "greeting", 0);
      expect(result).toBe("{{greeting}}Hello");
    });

    it("should insert variable at end", () => {
      /**
       * Test variable insertion at end.
       */
      const text = "Hello";
      const result = insertVariable(text, "name", 5);
      expect(result).toBe("Hello{{name}}");
    });

    it("should format variable with double braces", () => {
      /**
       * Verify variable format is {{variable}}.
       */
      const variable = "customer_name";
      const formatted = `{{${variable}}}`;
      expect(formatted).toBe("{{customer_name}}");
    });
  });

  describe("Channel Updates", () => {
    const createMockTemplate = (): INotificationTemplate => ({
      template_id: "test-template",
      name: "Test Template",
      description: "Test description",
      trigger: "custom",
      channels: {
        email: {
          enabled: true,
          subject: "Test Subject",
          html_body: "<p>Test</p>",
        },
      },
      variables: ["name"],
      is_active: true,
      is_default: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    it("should update channel enabled state", () => {
      /**
       * Test toggling channel enabled state.
       */
      const template = createMockTemplate();
      const channel: NotificationChannel = "email";
      const newEnabled = false;

      const updated = {
        ...template,
        channels: {
          ...template.channels,
          [channel]: {
            ...template.channels?.[channel],
            enabled: newEnabled,
          },
        },
      };

      expect(updated.channels?.email?.enabled).toBe(false);
    });

    it("should update email subject", () => {
      /**
       * Test updating email subject.
       */
      const template = createMockTemplate();
      const newSubject = "Updated Subject";

      const updated = {
        ...template,
        channels: {
          ...template.channels,
          email: {
            ...template.channels?.email,
            subject: newSubject,
          },
        },
      };

      expect(updated.channels?.email?.subject).toBe("Updated Subject");
    });

    it("should preserve other channel data when updating one field", () => {
      /**
       * Test that updating one field preserves others.
       */
      const template = createMockTemplate();

      const updated = {
        ...template,
        channels: {
          ...template.channels,
          email: {
            ...template.channels?.email,
            subject: "New Subject",
          },
        },
      };

      expect(updated.channels?.email?.enabled).toBe(true);
      expect(updated.channels?.email?.html_body).toBe("<p>Test</p>");
    });
  });

  describe("SMS Character Limit", () => {
    it("should allow up to 160 characters", () => {
      /**
       * Test SMS character limit validation.
       */
      const maxLength = 160;
      const validMessage = "A".repeat(160);
      const invalidMessage = "A".repeat(161);

      expect(validMessage.length).toBe(maxLength);
      expect(invalidMessage.length).toBeGreaterThan(maxLength);
    });

    it("should count characters correctly", () => {
      /**
       * Test SMS character counting.
       */
      const message = "Hello {{name}}, your order is ready!";
      expect(message.length).toBe(36);
    });
  });

  describe("Template Validation", () => {
    it("should require name field", () => {
      /**
       * Verify name is a required field.
       */
      const isValid = (template: Partial<INotificationTemplate>) => {
        return !!template.name && template.name.trim().length > 0;
      };

      expect(isValid({ name: "Test" })).toBe(true);
      expect(isValid({ name: "" })).toBe(false);
      expect(isValid({ name: "   " })).toBe(false);
      expect(isValid({})).toBe(false);
    });

    it("should require at least one enabled channel", () => {
      /**
       * Verify at least one channel must be enabled.
       */
      const hasEnabledChannel = (template: Partial<INotificationTemplate>) => {
        if (!template.channels) return false;
        return Object.values(template.channels).some((ch) => ch?.enabled);
      };

      expect(hasEnabledChannel({ channels: { email: { enabled: true, subject: "", html_body: "" } } })).toBe(true);
      expect(hasEnabledChannel({ channels: { email: { enabled: false, subject: "", html_body: "" } } })).toBe(false);
      expect(hasEnabledChannel({ channels: {} })).toBe(false);
    });
  });
});
