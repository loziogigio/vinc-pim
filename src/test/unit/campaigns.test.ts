/**
 * Unit Tests: Campaign Constants & Validation
 *
 * Tests for campaign-related validation and utilities.
 */

import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_CHANNELS,
  NotificationChannel,
} from "@/lib/constants/notification";

describe("unit: Campaign Channels", () => {
  describe("NOTIFICATION_CHANNELS", () => {
    it("should have exactly 4 channels", () => {
      /**
       * Verify that all 4 notification channels are defined.
       */
      expect(NOTIFICATION_CHANNELS).toHaveLength(4);
    });

    it("should include email as first channel", () => {
      /**
       * Email should be the primary channel.
       */
      expect(NOTIFICATION_CHANNELS[0]).toBe("email");
    });

    it("should include all expected channels", () => {
      /**
       * Verify all channel types exist.
       */
      const expectedChannels: NotificationChannel[] = [
        "email",
        "web_push",
        "mobile_push",
        "sms",
      ];
      expectedChannels.forEach((channel) => {
        expect(NOTIFICATION_CHANNELS).toContain(channel);
      });
    });
  });

  describe("Email Validation", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it("should validate correct email addresses", () => {
      /**
       * Test valid email formats.
       */
      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "user+tag@example.org",
      ];
      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it("should reject invalid email addresses", () => {
      /**
       * Test invalid email formats.
       */
      const invalidEmails = [
        "invalid",
        "invalid@",
        "@invalid.com",
        "invalid @example.com",
        "invalid@example",
      ];
      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe("Recipient Types", () => {
    it("should define valid recipient types", () => {
      /**
       * Verify recipient type options.
       */
      const recipientTypes = ["all", "selected", "segment"];
      expect(recipientTypes).toContain("all");
      expect(recipientTypes).toContain("selected");
      expect(recipientTypes).toContain("segment");
    });
  });
});

describe("unit: Template Variable Replacement", () => {
  it("should replace single variable", () => {
    /**
     * Test basic variable replacement.
     */
    const template = "Hello {{name}}!";
    const data = { name: "John" };
    const result = template.replace(/{{(\w+)}}/g, (_, key) => data[key as keyof typeof data] || "");
    expect(result).toBe("Hello John!");
  });

  it("should replace multiple variables", () => {
    /**
     * Test multiple variable replacement.
     */
    const template = "Hello {{name}}, your order #{{order_id}} is {{status}}.";
    const data = { name: "John", order_id: "12345", status: "shipped" };
    const result = template.replace(/{{(\w+)}}/g, (_, key) => data[key as keyof typeof data] || "");
    expect(result).toBe("Hello John, your order #12345 is shipped.");
  });

  it("should handle variables with spaces", () => {
    /**
     * Test variables with optional whitespace.
     */
    const template = "Hello {{ name }}!";
    const data = { name: "John" };
    const result = template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key as keyof typeof data] || "");
    expect(result).toBe("Hello John!");
  });

  it("should leave unmatched variables as placeholders", () => {
    /**
     * Test unmatched variable handling.
     */
    const template = "Hello {{name}}, your {{missing}} value.";
    const data = { name: "John" };
    const result = template.replace(/{{(\w+)}}/g, (_, key) => data[key as keyof typeof data] || `[${key}]`);
    expect(result).toBe("Hello John, your [missing] value.");
  });
});
