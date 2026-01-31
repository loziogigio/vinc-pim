/**
 * Unit Tests for Platform-Based Notification Tracking
 *
 * Tests the platform tracking feature that differentiates mobile app vs web browser
 * engagement for in-app notifications.
 */

import { describe, it, expect } from "vitest";
import {
  TRACKING_PLATFORMS,
  LOG_EVENT_TYPES,
  type TrackingPlatform,
} from "@/lib/constants/notification";

// ============================================
// CONSTANTS TESTS
// ============================================

describe("unit: TRACKING_PLATFORMS constant", () => {
  it("should have mobile and web platforms", () => {
    /**
     * Verify platform options are correctly defined.
     */
    expect(TRACKING_PLATFORMS).toContain("mobile");
    expect(TRACKING_PLATFORMS).toContain("web");
    expect(TRACKING_PLATFORMS).toHaveLength(2);
  });

  it("should allow type-safe platform values", () => {
    /**
     * TypeScript type safety check.
     */
    const mobilePlatform: TrackingPlatform = "mobile";
    const webPlatform: TrackingPlatform = "web";

    expect(mobilePlatform).toBe("mobile");
    expect(webPlatform).toBe("web");
  });
});

describe("unit: LOG_EVENT_TYPES constant", () => {
  it("should include opened and clicked event types", () => {
    /**
     * Verify event types used for tracking are defined.
     */
    expect(LOG_EVENT_TYPES).toContain("opened");
    expect(LOG_EVENT_TYPES).toContain("clicked");
    expect(LOG_EVENT_TYPES).toContain("read");
    expect(LOG_EVENT_TYPES).toContain("dismissed");
    expect(LOG_EVENT_TYPES).toContain("delivered");
  });
});

// ============================================
// PLATFORM COUNTER LOGIC TESTS
// ============================================

describe("unit: Platform counter increments", () => {
  /**
   * Tests the logic for incrementing platform-specific counters.
   * This mirrors the logic in recordEngagement() without database calls.
   */

  interface CounterUpdate {
    open_count?: number;
    click_count?: number;
    mobile_open_count?: number;
    mobile_click_count?: number;
    web_open_count?: number;
    web_click_count?: number;
  }

  function calculateCounterUpdate(
    eventType: "opened" | "clicked",
    platform: TrackingPlatform
  ): CounterUpdate {
    const update: CounterUpdate = {};

    if (eventType === "opened") {
      update.open_count = 1;
      if (platform === "mobile") {
        update.mobile_open_count = 1;
      } else {
        update.web_open_count = 1;
      }
    } else if (eventType === "clicked") {
      update.click_count = 1;
      if (platform === "mobile") {
        update.mobile_click_count = 1;
      } else {
        update.web_click_count = 1;
      }
    }

    return update;
  }

  it("should increment mobile_open_count for mobile platform opened event", () => {
    /**
     * Mobile platform "opened" event should increment:
     * - open_count (total)
     * - mobile_open_count (platform-specific)
     */
    const update = calculateCounterUpdate("opened", "mobile");

    expect(update.open_count).toBe(1);
    expect(update.mobile_open_count).toBe(1);
    expect(update.web_open_count).toBeUndefined();
  });

  it("should increment web_open_count for web platform opened event", () => {
    /**
     * Web platform "opened" event should increment:
     * - open_count (total)
     * - web_open_count (platform-specific)
     */
    const update = calculateCounterUpdate("opened", "web");

    expect(update.open_count).toBe(1);
    expect(update.web_open_count).toBe(1);
    expect(update.mobile_open_count).toBeUndefined();
  });

  it("should increment mobile_click_count for mobile platform clicked event", () => {
    /**
     * Mobile platform "clicked" event should increment:
     * - click_count (total)
     * - mobile_click_count (platform-specific)
     */
    const update = calculateCounterUpdate("clicked", "mobile");

    expect(update.click_count).toBe(1);
    expect(update.mobile_click_count).toBe(1);
    expect(update.web_click_count).toBeUndefined();
  });

  it("should increment web_click_count for web platform clicked event", () => {
    /**
     * Web platform "clicked" event should increment:
     * - click_count (total)
     * - web_click_count (platform-specific)
     */
    const update = calculateCounterUpdate("clicked", "web");

    expect(update.click_count).toBe(1);
    expect(update.web_click_count).toBe(1);
    expect(update.mobile_click_count).toBeUndefined();
  });
});

// ============================================
// STATS AGGREGATION LOGIC TESTS
// ============================================

describe("unit: Campaign stats aggregation", () => {
  /**
   * Tests the logic for aggregating campaign stats by platform.
   */

  interface AggregationRow {
    _id: string;
    sent: number;
    failed: number;
    opened: number;
    clicked: number;
    mobile_opened: number;
    mobile_clicked: number;
    web_opened: number;
    web_clicked: number;
    read: number;
  }

  interface CampaignStats {
    email: { sent: number; failed: number; opened: number; clicked: number };
    mobile_app: { sent: number; failed: number; opened: number; clicked: number; read: number };
    web: { sent: number; failed: number; opened: number; clicked: number; read: number };
  }

  function buildCampaignStats(rows: AggregationRow[]): CampaignStats {
    const stats: CampaignStats = {
      email: { sent: 0, failed: 0, opened: 0, clicked: 0 },
      mobile_app: { sent: 0, failed: 0, opened: 0, clicked: 0, read: 0 },
      web: { sent: 0, failed: 0, opened: 0, clicked: 0, read: 0 },
    };

    for (const row of rows) {
      if (row._id === "email") {
        stats.email = {
          sent: row.sent,
          failed: row.failed,
          opened: row.opened,
          clicked: row.clicked,
        };
      } else if (row._id === "web_in_app") {
        stats.mobile_app = {
          sent: row.sent,
          failed: row.failed,
          opened: row.mobile_opened,
          clicked: row.mobile_clicked,
          read: row.read,
        };
        stats.web = {
          sent: row.sent,
          failed: row.failed,
          opened: row.web_opened,
          clicked: row.web_clicked,
          read: row.read,
        };
      }
    }

    return stats;
  }

  it("should separate email stats from in-app stats", () => {
    /**
     * Email channel should have its own stats,
     * separate from mobile_app and web.
     */
    const rows: AggregationRow[] = [
      {
        _id: "email",
        sent: 100,
        failed: 5,
        opened: 42,
        clicked: 15,
        mobile_opened: 0,
        mobile_clicked: 0,
        web_opened: 0,
        web_clicked: 0,
        read: 0,
      },
    ];

    const stats = buildCampaignStats(rows);

    expect(stats.email.sent).toBe(100);
    expect(stats.email.failed).toBe(5);
    expect(stats.email.opened).toBe(42);
    expect(stats.email.clicked).toBe(15);
  });

  it("should split web_in_app stats by platform", () => {
    /**
     * web_in_app channel should be split into mobile_app and web
     * based on platform-specific counters.
     * Sent/failed are shared, opens/clicks are platform-specific.
     */
    const rows: AggregationRow[] = [
      {
        _id: "web_in_app",
        sent: 90,
        failed: 1,
        opened: 45, // Total opens (should not be used)
        clicked: 20, // Total clicks (should not be used)
        mobile_opened: 35,
        mobile_clicked: 12,
        web_opened: 10,
        web_clicked: 8,
        read: 40,
      },
    ];

    const stats = buildCampaignStats(rows);

    // Mobile app stats
    expect(stats.mobile_app.sent).toBe(90); // Shared
    expect(stats.mobile_app.failed).toBe(1); // Shared
    expect(stats.mobile_app.opened).toBe(35); // Platform-specific
    expect(stats.mobile_app.clicked).toBe(12); // Platform-specific
    expect(stats.mobile_app.read).toBe(40); // Shared

    // Web stats
    expect(stats.web.sent).toBe(90); // Shared
    expect(stats.web.failed).toBe(1); // Shared
    expect(stats.web.opened).toBe(10); // Platform-specific
    expect(stats.web.clicked).toBe(8); // Platform-specific
    expect(stats.web.read).toBe(40); // Shared
  });

  it("should handle empty aggregation results", () => {
    /**
     * When no notification logs exist, stats should default to zeros.
     */
    const stats = buildCampaignStats([]);

    expect(stats.email.sent).toBe(0);
    expect(stats.mobile_app.sent).toBe(0);
    expect(stats.web.sent).toBe(0);
  });

  it("should handle combined email and web_in_app channels", () => {
    /**
     * Campaign with both email and in-app channels should
     * populate all three result sections.
     */
    const rows: AggregationRow[] = [
      {
        _id: "email",
        sent: 100,
        failed: 5,
        opened: 42,
        clicked: 15,
        mobile_opened: 0,
        mobile_clicked: 0,
        web_opened: 0,
        web_clicked: 0,
        read: 0,
      },
      {
        _id: "web_in_app",
        sent: 90,
        failed: 1,
        opened: 45,
        clicked: 20,
        mobile_opened: 35,
        mobile_clicked: 12,
        web_opened: 10,
        web_clicked: 8,
        read: 40,
      },
    ];

    const stats = buildCampaignStats(rows);

    // All three sections should be populated
    expect(stats.email.sent).toBe(100);
    expect(stats.mobile_app.sent).toBe(90);
    expect(stats.web.sent).toBe(90);

    // Platform-specific engagement
    expect(stats.email.opened).toBe(42);
    expect(stats.mobile_app.opened).toBe(35);
    expect(stats.web.opened).toBe(10);
  });
});

// ============================================
// RATE CALCULATION TESTS
// ============================================

describe("unit: Engagement rate calculations", () => {
  /**
   * Tests rate calculations for opens and clicks.
   * Rates should be capped at 100% (1.0) for display.
   */

  function calculateRate(count: number, sent: number): number {
    return sent > 0 ? Math.min(count / sent, 1) : 0;
  }

  it("should calculate rate correctly for normal case", () => {
    /**
     * 50 opens out of 100 sent = 50% rate.
     */
    const rate = calculateRate(50, 100);
    expect(rate).toBe(0.5);
  });

  it("should cap rate at 100% when count exceeds sent", () => {
    /**
     * Multiple opens (150) from same users should cap at 100%.
     */
    const rate = calculateRate(150, 100);
    expect(rate).toBe(1);
  });

  it("should return 0 when sent is 0", () => {
    /**
     * Avoid division by zero.
     */
    const rate = calculateRate(10, 0);
    expect(rate).toBe(0);
  });

  it("should return 0 when both count and sent are 0", () => {
    /**
     * No notifications sent, no engagement.
     */
    const rate = calculateRate(0, 0);
    expect(rate).toBe(0);
  });

  it("should handle small decimal rates", () => {
    /**
     * 1 open out of 100 sent = 1% rate.
     */
    const rate = calculateRate(1, 100);
    expect(rate).toBe(0.01);
  });
});

// ============================================
// TRACKING PAYLOAD VALIDATION TESTS
// ============================================

describe("unit: Tracking payload validation", () => {
  /**
   * Tests validation of tracking API payloads.
   */

  interface TrackPayload {
    log_id: string;
    event: string;
    platform?: "mobile" | "web";
    metadata?: {
      url?: string;
      sku?: string;
    };
  }

  function validatePayload(payload: Partial<TrackPayload>): { valid: boolean; error?: string } {
    if (!payload.log_id) {
      return { valid: false, error: "log_id is required" };
    }
    if (!payload.event) {
      return { valid: false, error: "event is required" };
    }
    const validEvents = ["delivered", "opened", "clicked", "read", "dismissed"];
    if (!validEvents.includes(payload.event)) {
      return { valid: false, error: `Invalid event type` };
    }
    if (payload.platform && !["mobile", "web"].includes(payload.platform)) {
      return { valid: false, error: "Invalid platform" };
    }
    return { valid: true };
  }

  it("should validate correct payload with mobile platform", () => {
    /**
     * Complete payload with mobile platform should be valid.
     */
    const payload: TrackPayload = {
      log_id: "nlog_abc123",
      event: "opened",
      platform: "mobile",
    };

    const result = validatePayload(payload);
    expect(result.valid).toBe(true);
  });

  it("should validate correct payload with web platform", () => {
    /**
     * Complete payload with web platform should be valid.
     */
    const payload: TrackPayload = {
      log_id: "nlog_abc123",
      event: "clicked",
      platform: "web",
      metadata: { url: "https://example.com" },
    };

    const result = validatePayload(payload);
    expect(result.valid).toBe(true);
  });

  it("should validate correct payload without platform (defaults to web)", () => {
    /**
     * Platform is optional, defaults to "web".
     */
    const payload: TrackPayload = {
      log_id: "nlog_abc123",
      event: "opened",
    };

    const result = validatePayload(payload);
    expect(result.valid).toBe(true);
  });

  it("should reject payload without log_id", () => {
    /**
     * log_id is required for tracking.
     */
    const payload = {
      event: "opened",
      platform: "mobile" as const,
    };

    const result = validatePayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("log_id is required");
  });

  it("should reject payload without event", () => {
    /**
     * event is required for tracking.
     */
    const payload = {
      log_id: "nlog_abc123",
      platform: "mobile" as const,
    };

    const result = validatePayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("event is required");
  });

  it("should reject payload with invalid event type", () => {
    /**
     * Event must be one of the valid types.
     */
    const payload = {
      log_id: "nlog_abc123",
      event: "invalid_event",
      platform: "mobile" as const,
    };

    const result = validatePayload(payload);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid event type");
  });
});

// ============================================
// DISPLAY CHANNEL MAPPING TESTS
// ============================================

describe("unit: Display channel configuration", () => {
  /**
   * Tests the display channel labels and configuration.
   */

  const DISPLAY_CHANNEL_LABELS = {
    email: "Email",
    mobile_app: "Mobile App",
    web: "Web",
  };

  const channelColors = {
    email: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    mobile_app: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
    web: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  };

  it("should have correct labels for all display channels", () => {
    /**
     * All three display channels should have human-readable labels.
     */
    expect(DISPLAY_CHANNEL_LABELS.email).toBe("Email");
    expect(DISPLAY_CHANNEL_LABELS.mobile_app).toBe("Mobile App");
    expect(DISPLAY_CHANNEL_LABELS.web).toBe("Web");
  });

  it("should have unique colors for each channel", () => {
    /**
     * Each channel should have distinct visual styling.
     */
    expect(channelColors.email.bg).toBe("bg-blue-50");
    expect(channelColors.mobile_app.bg).toBe("bg-purple-50");
    expect(channelColors.web.bg).toBe("bg-emerald-50");

    // All backgrounds should be different
    const backgrounds = Object.values(channelColors).map((c) => c.bg);
    const uniqueBackgrounds = new Set(backgrounds);
    expect(uniqueBackgrounds.size).toBe(3);
  });
});
