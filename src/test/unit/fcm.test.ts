/**
 * Unit Tests: FCM (Firebase Cloud Messaging) Types & Service
 *
 * Tests for FCM types, token model, and service exports.
 */

import { describe, it, expect } from "vitest";
import type {
  FCMPlatform,
  FCMUserType,
  FCMPreferences,
  FCMConfig,
  SendFCMOptions,
  SendFCMResult,
  FCMPayload,
  FCMJobData,
} from "@/lib/fcm/types";

describe("unit: FCM Types", () => {
  describe("FCMPlatform", () => {
    it("should allow valid platform values", () => {
      /**
       * Verify platform type accepts ios and android.
       */
      const ios: FCMPlatform = "ios";
      const android: FCMPlatform = "android";
      expect(["ios", "android"]).toContain(ios);
      expect(["ios", "android"]).toContain(android);
    });
  });

  describe("FCMUserType", () => {
    it("should allow valid user type values", () => {
      /**
       * Verify user type accepts b2b_user and portal_user.
       */
      const b2b: FCMUserType = "b2b_user";
      const portal: FCMUserType = "portal_user";
      expect(["b2b_user", "portal_user"]).toContain(b2b);
      expect(["b2b_user", "portal_user"]).toContain(portal);
    });
  });

  describe("FCMPreferences", () => {
    it("should have all preference fields as boolean", () => {
      /**
       * Verify preferences object structure.
       */
      const prefs: FCMPreferences = {
        order_updates: true,
        price_alerts: false,
        marketing: false,
        system: true,
      };
      expect(typeof prefs.order_updates).toBe("boolean");
      expect(typeof prefs.price_alerts).toBe("boolean");
      expect(typeof prefs.marketing).toBe("boolean");
      expect(typeof prefs.system).toBe("boolean");
    });
  });

  describe("FCMConfig", () => {
    it("should have required Firebase config fields", () => {
      /**
       * Verify FCM config structure.
       */
      const config: FCMConfig = {
        project_id: "test-project",
        private_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        client_email: "test@test-project.iam.gserviceaccount.com",
      };
      expect(config.project_id).toBe("test-project");
      expect(config.private_key).toContain("PRIVATE KEY");
      expect(config.client_email).toContain("@");
    });
  });

  describe("SendFCMOptions", () => {
    it("should have required fields for sending", () => {
      /**
       * Verify send options structure.
       */
      const options: SendFCMOptions = {
        tenantDb: "vinc-test",
        title: "Test Title",
        body: "Test Body",
      };
      expect(options.tenantDb).toBe("vinc-test");
      expect(options.title).toBe("Test Title");
      expect(options.body).toBe("Test Body");
    });

    it("should allow optional targeting fields", () => {
      /**
       * Verify optional targeting options.
       */
      const options: SendFCMOptions = {
        tenantDb: "vinc-test",
        title: "Test Title",
        body: "Test Body",
        userIds: ["user1", "user2"],
        tokenIds: ["token1"],
        preferenceType: "order_updates",
        queue: true,
        priority: "high",
        badge: 5,
        channelId: "orders",
        ttl: 3600,
      };
      expect(options.userIds).toHaveLength(2);
      expect(options.queue).toBe(true);
      expect(options.priority).toBe("high");
    });
  });

  describe("SendFCMResult", () => {
    it("should have success and count fields", () => {
      /**
       * Verify result structure.
       */
      const result: SendFCMResult = {
        success: true,
        sent: 5,
        failed: 0,
      };
      expect(result.success).toBe(true);
      expect(result.sent).toBe(5);
      expect(result.failed).toBe(0);
    });

    it("should allow queued count", () => {
      /**
       * Verify queued result structure.
       */
      const result: SendFCMResult = {
        success: true,
        queued: 10,
        sent: 0,
        failed: 0,
      };
      expect(result.queued).toBe(10);
    });

    it("should allow error details", () => {
      /**
       * Verify error reporting structure.
       */
      const result: SendFCMResult = {
        success: false,
        sent: 0,
        failed: 2,
        errors: [
          { tokenId: "token1", error: "Token expired" },
          { tokenId: "token2", error: "Invalid token" },
        ],
      };
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0].error).toBe("Token expired");
    });
  });

  describe("FCMPayload", () => {
    it("should have required notification fields", () => {
      /**
       * Verify payload structure.
       */
      const payload: FCMPayload = {
        title: "Test",
        body: "Body",
      };
      expect(payload.title).toBe("Test");
      expect(payload.body).toBe("Body");
    });

    it("should allow optional fields", () => {
      /**
       * Verify optional payload fields.
       */
      const payload: FCMPayload = {
        title: "Test",
        body: "Body",
        icon: "https://example.com/icon.png",
        image: "https://example.com/image.png",
        action_url: "https://example.com/action",
        data: { order_id: "123", type: "order" },
      };
      expect(payload.icon).toContain("icon.png");
      expect(payload.data?.order_id).toBe("123");
    });
  });

  describe("FCMJobData", () => {
    it("should have required job fields for worker", () => {
      /**
       * Verify job data structure for BullMQ worker.
       */
      const job: FCMJobData = {
        tenantDb: "vinc-test",
        tokenId: "fcm_abc123",
        fcmToken: "firebase-token-string",
        platform: "android",
        payload: {
          title: "Test",
          body: "Body",
        },
      };
      expect(job.tenantDb).toBe("vinc-test");
      expect(job.tokenId).toContain("fcm_");
      expect(job.platform).toBe("android");
    });
  });
});

describe("unit: FCM Service Exports", () => {
  it("should export all required functions", async () => {
    /**
     * Verify FCM service exports main functions.
     */
    const fcmModule = await import("@/lib/fcm");

    // Main service functions
    expect(typeof fcmModule.sendFCM).toBe("function");
    expect(typeof fcmModule.processQueuedFCM).toBe("function");
    expect(typeof fcmModule.getFCMStats).toBe("function");
    expect(typeof fcmModule.getFCMLogs).toBe("function");

    // Config functions
    expect(typeof fcmModule.isFCMEnabled).toBe("function");
    expect(typeof fcmModule.getFirebaseMessaging).toBe("function");
    expect(typeof fcmModule.getFCMSettings).toBe("function");

    // Token functions
    expect(typeof fcmModule.registerToken).toBe("function");
    expect(typeof fcmModule.getActiveTokens).toBe("function");
    expect(typeof fcmModule.getTokenStats).toBe("function");
  });
});
