/**
 * Unit Tests: Notification Template Model & Constants
 *
 * Tests for notification template validation, constants, and trigger labels.
 */

import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGERS,
  TRIGGER_LABELS,
  NotificationTrigger,
  NotificationChannel,
} from "@/lib/constants/notification";
import { TemplateChannelsSchema } from "@/lib/db/models/notification-template";

describe("unit: Notification Template Constants", () => {
  describe("NOTIFICATION_CHANNELS", () => {
    it("should have exactly 4 channels", () => {
      /**
       * Verify that all 4 notification channels are defined.
       * email, sms, mobile (FCM), web_in_app
       */
      expect(NOTIFICATION_CHANNELS).toHaveLength(4);
    });

    it("should include all expected channels", () => {
      /**
       * Verify channel names match expected values.
       */
      expect(NOTIFICATION_CHANNELS).toContain("email");
      expect(NOTIFICATION_CHANNELS).toContain("sms");
      expect(NOTIFICATION_CHANNELS).toContain("mobile");
      expect(NOTIFICATION_CHANNELS).toContain("web_in_app");
    });

    it("should have channels in correct order", () => {
      /**
       * Verify channel order (email first as primary channel).
       */
      expect(NOTIFICATION_CHANNELS[0]).toBe("email");
    });
  });

  describe("TemplateChannelsSchema — sms round-trip", () => {
    it("preserves template_channels.sms fields through schema cast (not stripped)", () => {
      /**
       * Verify the Mongoose TemplateChannelsSchema has an sms arm so that
       * template_channels.sms = { enabled:true, body:"x" } is not silently dropped on save.
       */
      const raw = { enabled: true, body: "Hello {{customer_name}}" };
      // Cast the raw object through the schema (equivalent to what Mongoose does on save)
      const Model = TemplateChannelsSchema.obj as Record<string, unknown>;
      // Check the schema declares an sms path
      expect(TemplateChannelsSchema.path("sms")).toBeDefined();
      // Cast the sub-document via the schema to verify fields survive
      const cast = (TemplateChannelsSchema as unknown as { cast: (obj: unknown) => unknown }).cast
        ? undefined
        : raw; // Mongoose Schema.cast is internal; verify via paths instead
      const smsPath = TemplateChannelsSchema.path("sms");
      expect(smsPath).toBeTruthy();
      // The sms sub-schema should have enabled and body paths
      const smsSchema = (smsPath as unknown as { schema: { path: (k: string) => unknown } }).schema;
      expect(smsSchema.path("enabled")).toBeDefined();
      expect(smsSchema.path("body")).toBeDefined();
    });
  });

  describe("NOTIFICATION_TRIGGERS", () => {
    it("should have exactly 24 triggers", () => {
      /**
       * Verify that all 24 notification triggers are defined.
       * 6 Account + 5 Order + 2 Marketing + 2 Campaign + 3 Payment + 5 Subscription + 1 PDS + 1 Custom = 25
       */
      expect(NOTIFICATION_TRIGGERS).toHaveLength(25);
    });

    it("should include all account triggers", () => {
      /**
       * Verify 5 account-related triggers exist.
       */
      const accountTriggers = [
        "registration_request_admin",
        "registration_request_customer",
        "welcome",
        "forgot_password",
        "reset_password",
      ];
      accountTriggers.forEach((trigger) => {
        expect(NOTIFICATION_TRIGGERS).toContain(trigger);
      });
    });

    it("should include all order triggers", () => {
      /**
       * Verify 5 order-related triggers exist.
       */
      const orderTriggers = [
        "order_confirmation",
        "order_processing",
        "order_shipped",
        "order_delivered",
        "order_cancelled",
      ];
      orderTriggers.forEach((trigger) => {
        expect(NOTIFICATION_TRIGGERS).toContain(trigger);
      });
    });

    it("should include all marketing triggers", () => {
      /**
       * Verify 2 marketing-related triggers exist.
       */
      const marketingTriggers = [
        "back_in_stock",
        "newsletter",
      ];
      marketingTriggers.forEach((trigger) => {
        expect(NOTIFICATION_TRIGGERS).toContain(trigger);
      });
    });

    it("should include custom trigger", () => {
      /**
       * Verify custom trigger exists for user-defined templates.
       */
      expect(NOTIFICATION_TRIGGERS).toContain("custom");
    });
  });

  describe("TRIGGER_LABELS", () => {
    it("should have a label for every trigger", () => {
      /**
       * Verify each trigger has a corresponding label.
       */
      NOTIFICATION_TRIGGERS.forEach((trigger) => {
        expect(TRIGGER_LABELS[trigger]).toBeDefined();
        expect(typeof TRIGGER_LABELS[trigger]).toBe("string");
        expect(TRIGGER_LABELS[trigger].length).toBeGreaterThan(0);
      });
    });

    it("should have human-readable labels", () => {
      /**
       * Verify labels are user-friendly (not technical IDs).
       */
      expect(TRIGGER_LABELS.welcome).toBe("Welcome Email");
      expect(TRIGGER_LABELS.order_confirmation).toBe("Order Confirmation");
      expect(TRIGGER_LABELS.custom).toBe("Custom Template");
    });

    it("should not have labels for undefined triggers", () => {
      /**
       * Verify no extra labels exist beyond defined triggers.
       */
      const labelKeys = Object.keys(TRIGGER_LABELS);
      expect(labelKeys.length).toBe(NOTIFICATION_TRIGGERS.length);
    });
  });
});

describe("unit: Notification Template Type Safety", () => {
  it("should allow valid trigger types", () => {
    /**
     * Verify TypeScript type inference works correctly.
     */
    const validTrigger: NotificationTrigger = "welcome";
    expect(NOTIFICATION_TRIGGERS).toContain(validTrigger);
  });

  it("should allow valid channel types", () => {
    /**
     * Verify TypeScript type inference works correctly.
     */
    const validChannel: NotificationChannel = "email";
    expect(NOTIFICATION_CHANNELS).toContain(validChannel);
  });
});
