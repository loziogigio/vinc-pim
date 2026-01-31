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

describe("unit: Notification Template Constants", () => {
  describe("NOTIFICATION_CHANNELS", () => {
    it("should have exactly 3 channels", () => {
      /**
       * Verify that all 3 notification channels are defined.
       * email, mobile (FCM), web_in_app
       */
      expect(NOTIFICATION_CHANNELS).toHaveLength(3);
    });

    it("should include all expected channels", () => {
      /**
       * Verify channel names match expected values.
       */
      expect(NOTIFICATION_CHANNELS).toContain("email");
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

  describe("NOTIFICATION_TRIGGERS", () => {
    it("should have exactly 16 triggers", () => {
      /**
       * Verify that all 16 notification triggers are defined.
       * 5 Account + 4 Order + 4 Marketing + 2 Campaign + 1 Custom = 16
       */
      expect(NOTIFICATION_TRIGGERS).toHaveLength(16);
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
       * Verify 4 order-related triggers exist.
       */
      const orderTriggers = [
        "order_confirmation",
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
       * Verify 4 marketing-related triggers exist.
       */
      const marketingTriggers = [
        "price_drop_alert",
        "back_in_stock",
        "abandoned_cart",
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
