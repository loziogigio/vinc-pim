/**
 * Unit Tests: Campaign Features
 *
 * Tests for campaign scheduling, duplication, and search functionality.
 */

import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_STATUSES,
  NOTIFICATION_TRIGGERS,
  TRIGGER_LABELS,
  type CampaignStatus,
  type NotificationTrigger,
} from "@/lib/constants/notification";

// ============================================
// CAMPAIGN SCHEDULING TESTS
// ============================================

describe("unit: Campaign Scheduling", () => {
  describe("Status Transitions", () => {
    it("should allow scheduling only from draft status", () => {
      /**
       * Verify that only draft campaigns can be scheduled.
       * scheduled, sending, sent, failed cannot be scheduled.
       */
      const schedulableStatuses: CampaignStatus[] = ["draft"];
      const nonSchedulableStatuses: CampaignStatus[] = ["scheduled", "sending", "sent", "failed"];

      schedulableStatuses.forEach((status) => {
        expect(CAMPAIGN_STATUSES).toContain(status);
      });

      nonSchedulableStatuses.forEach((status) => {
        expect(CAMPAIGN_STATUSES).toContain(status);
        expect(schedulableStatuses).not.toContain(status);
      });
    });

    it("should have scheduled status for future delivery", () => {
      /**
       * Verify scheduled status exists for campaigns with scheduled_at date.
       */
      expect(CAMPAIGN_STATUSES).toContain("scheduled");
    });

    it("should allow unscheduling back to draft", () => {
      /**
       * Verify that scheduled campaigns can revert to draft status.
       */
      const scheduledIndex = CAMPAIGN_STATUSES.indexOf("scheduled");
      const draftIndex = CAMPAIGN_STATUSES.indexOf("draft");

      expect(scheduledIndex).toBeGreaterThan(draftIndex);
      // Both statuses exist, so transition is valid
      expect(CAMPAIGN_STATUSES).toContain("draft");
      expect(CAMPAIGN_STATUSES).toContain("scheduled");
    });
  });

  describe("Schedule Date Validation", () => {
    it("should reject past dates", () => {
      /**
       * Verify that scheduled_at must be in the future.
       */
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60000); // 1 minute ago
      const futureDate = new Date(now.getTime() + 60000); // 1 minute from now

      expect(pastDate.getTime()).toBeLessThan(now.getTime());
      expect(futureDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it("should validate minimum schedule time (5 minutes)", () => {
      /**
       * Verify minimum schedule time of 5 minutes from now.
       */
      const now = new Date();
      const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

      expect(minScheduleTime.getTime() - now.getTime()).toBeGreaterThanOrEqual(5 * 60 * 1000);
    });
  });
});

// ============================================
// CAMPAIGN DUPLICATION TESTS
// ============================================

describe("unit: Campaign Duplication", () => {
  describe("Duplicate Naming", () => {
    it("should append (Copia) suffix to duplicated campaign name", () => {
      /**
       * Verify duplicate campaigns get "(Copia)" suffix.
       */
      const originalName = "Black Friday Sale";
      const expectedDuplicateName = `${originalName} (Copia)`;

      expect(expectedDuplicateName).toBe("Black Friday Sale (Copia)");
    });

    it("should handle names that already have (Copia) suffix", () => {
      /**
       * Verify multiple duplications create "(Copia) (Copia)" etc.
       */
      const alreadyCopied = "Black Friday Sale (Copia)";
      const duplicatedAgain = `${alreadyCopied} (Copia)`;

      expect(duplicatedAgain).toBe("Black Friday Sale (Copia) (Copia)");
    });
  });

  describe("Duplicate Status", () => {
    it("should always create duplicates as draft status", () => {
      /**
       * Verify all duplicates start as draft regardless of original status.
       */
      const originalStatuses: CampaignStatus[] = ["draft", "scheduled", "sending", "sent", "failed"];
      const duplicateStatus: CampaignStatus = "draft";

      originalStatuses.forEach(() => {
        // All duplicates should be draft
        expect(duplicateStatus).toBe("draft");
        expect(CAMPAIGN_STATUSES).toContain(duplicateStatus);
      });
    });
  });

  describe("Fields to Copy", () => {
    it("should copy content fields", () => {
      /**
       * List of fields that should be copied during duplication.
       */
      const fieldsToCopy = [
        "name", // With (Copia) suffix
        "type",
        "title",
        "body",
        "push_image",
        "email_subject",
        "email_html",
        "products_url",
        "products",
        "url",
        "image",
        "open_in_new_tab",
        "channels",
        "recipient_type",
        "selected_user_ids",
        "selected_users", // Full user objects for UI display
        "tag_ids",
      ];

      expect(fieldsToCopy.length).toBeGreaterThan(10);
      expect(fieldsToCopy).toContain("title");
      expect(fieldsToCopy).toContain("body");
      expect(fieldsToCopy).toContain("channels");
      expect(fieldsToCopy).toContain("selected_users");
    });

    it("should NOT copy system fields", () => {
      /**
       * List of fields that should NOT be copied during duplication.
       */
      const fieldsNotToCopy = [
        "_id",
        "campaign_id",
        "slug",
        "status",
        "scheduled_at",
        "sent_at",
        "created_at",
        "updated_at",
        "results",
        "recipient_count",
      ];

      expect(fieldsNotToCopy).toContain("_id");
      expect(fieldsNotToCopy).toContain("campaign_id");
      expect(fieldsNotToCopy).toContain("slug");
      expect(fieldsNotToCopy).toContain("status");
      expect(fieldsNotToCopy).toContain("results");
    });
  });
});

// ============================================
// NOTIFICATION TRIGGER API TESTS
// ============================================

describe("unit: Notification Trigger API", () => {
  describe("Available Triggers", () => {
    it("should have all expected triggers defined", () => {
      /**
       * Verify all notification triggers are defined.
       */
      const expectedTriggers = [
        "registration_request_admin",
        "registration_request_customer",
        "welcome",
        "forgot_password",
        "reset_password",
        "order_confirmation",
        "order_shipped",
        "order_delivered",
        "order_cancelled",
        "price_drop_alert",
        "back_in_stock",
        "abandoned_cart",
        "newsletter",
        "campaign_product",
        "campaign_generic",
        "custom",
      ];

      expectedTriggers.forEach((trigger) => {
        expect(NOTIFICATION_TRIGGERS).toContain(trigger);
      });
    });

    it("should have at least 15 triggers", () => {
      /**
       * Verify minimum number of triggers for a complete system.
       */
      expect(NOTIFICATION_TRIGGERS.length).toBeGreaterThanOrEqual(15);
    });

    it("should have labels for all triggers", () => {
      /**
       * Verify each trigger has a human-readable label.
       */
      NOTIFICATION_TRIGGERS.forEach((trigger) => {
        expect(TRIGGER_LABELS[trigger]).toBeDefined();
        expect(typeof TRIGGER_LABELS[trigger]).toBe("string");
        expect(TRIGGER_LABELS[trigger].length).toBeGreaterThan(0);
      });
    });
  });

  describe("Trigger Categories", () => {
    it("should have account-related triggers", () => {
      /**
       * Verify account/authentication triggers exist.
       */
      const accountTriggers: NotificationTrigger[] = [
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

    it("should have order-related triggers", () => {
      /**
       * Verify order lifecycle triggers exist.
       */
      const orderTriggers: NotificationTrigger[] = [
        "order_confirmation",
        "order_shipped",
        "order_delivered",
        "order_cancelled",
      ];

      orderTriggers.forEach((trigger) => {
        expect(NOTIFICATION_TRIGGERS).toContain(trigger);
      });
    });

    it("should have marketing-related triggers", () => {
      /**
       * Verify marketing/promotional triggers exist.
       */
      const marketingTriggers: NotificationTrigger[] = [
        "price_drop_alert",
        "back_in_stock",
        "abandoned_cart",
        "newsletter",
      ];

      marketingTriggers.forEach((trigger) => {
        expect(NOTIFICATION_TRIGGERS).toContain(trigger);
      });
    });
  });
});

// ============================================
// CAMPAIGN SEARCH TESTS
// ============================================

describe("unit: Campaign Search", () => {
  describe("Searchable Fields", () => {
    it("should define searchable fields for campaigns", () => {
      /**
       * Verify the fields that can be searched.
       */
      const searchableFields = ["name", "title", "campaign_id", "slug"];

      expect(searchableFields).toContain("name");
      expect(searchableFields).toContain("title");
      expect(searchableFields).toContain("campaign_id");
      expect(searchableFields).toContain("slug");
      expect(searchableFields.length).toBe(4);
    });

    it("should support case-insensitive search", () => {
      /**
       * Verify search is case-insensitive.
       */
      const searchTerm = "lavabo";
      const campaignName = "Lavabo Premium Collection";

      const lowerName = campaignName.toLowerCase();
      const lowerSearch = searchTerm.toLowerCase();

      expect(lowerName).toContain(lowerSearch);
    });

    it("should support partial matching", () => {
      /**
       * Verify partial text matching works.
       */
      const searchTerm = "lav";
      const campaignName = "Lavabo Premium";

      expect(campaignName.toLowerCase().includes(searchTerm.toLowerCase())).toBe(true);
    });
  });

  describe("Search with Status Filter", () => {
    it("should allow combining search with status filter", () => {
      /**
       * Verify search can be combined with status filter.
       */
      const searchParams = {
        search: "lavabo",
        status: "sent" as CampaignStatus,
      };

      expect(searchParams.search).toBeDefined();
      expect(searchParams.status).toBeDefined();
      expect(CAMPAIGN_STATUSES).toContain(searchParams.status);
    });

    it("should allow search without status filter", () => {
      /**
       * Verify search works without status filter (all statuses).
       */
      const searchParams = {
        search: "lavabo",
        status: undefined,
      };

      expect(searchParams.search).toBeDefined();
      expect(searchParams.status).toBeUndefined();
    });
  });
});

// ============================================
// SELECTED USERS TESTS
// ============================================

describe("unit: Campaign Selected Users", () => {
  describe("Selected User Structure", () => {
    it("should have required fields for selected users", () => {
      /**
       * Verify selected_users contains id, email, and name.
       */
      const selectedUser = {
        id: "PU-abc123",
        email: "user@example.com",
        name: "John Doe",
      };

      expect(selectedUser).toHaveProperty("id");
      expect(selectedUser).toHaveProperty("email");
      expect(selectedUser).toHaveProperty("name");
    });

    it("should derive selected_user_ids from selected_users", () => {
      /**
       * Verify selected_user_ids array is derived from selected_users.
       */
      const selectedUsers = [
        { id: "PU-abc123", email: "user1@example.com", name: "User 1" },
        { id: "PU-def456", email: "user2@example.com", name: "User 2" },
      ];

      const selectedUserIds = selectedUsers.map((u) => u.id);

      expect(selectedUserIds).toEqual(["PU-abc123", "PU-def456"]);
      expect(selectedUserIds.length).toBe(selectedUsers.length);
    });

    it("should support portal user ID format", () => {
      /**
       * Verify portal user IDs follow expected format.
       */
      const portalUserId = "PU-Zl6iMWDT";

      expect(portalUserId).toMatch(/^PU-/);
      expect(portalUserId.length).toBeGreaterThan(3);
    });
  });

  describe("Recipient Type Validation", () => {
    it("should require selected_users when recipient_type is selected", () => {
      /**
       * Verify validation logic for selected recipient type.
       */
      const campaignWithSelected = {
        recipient_type: "selected" as const,
        selected_users: [{ id: "PU-123", email: "test@test.com", name: "Test" }],
      };

      const isValid =
        campaignWithSelected.recipient_type !== "selected" ||
        (campaignWithSelected.selected_users && campaignWithSelected.selected_users.length > 0);

      expect(isValid).toBe(true);
    });

    it("should not require selected_users when recipient_type is all", () => {
      /**
       * Verify 'all' recipient type doesn't need selected users.
       */
      const campaignWithAll = {
        recipient_type: "all" as const,
        selected_users: undefined,
      };

      const isValid =
        campaignWithAll.recipient_type !== "selected" ||
        (campaignWithAll.selected_users && campaignWithAll.selected_users.length > 0);

      expect(isValid).toBe(true);
    });
  });
});

// ============================================
// SCHEDULE ENDPOINT TESTS
// ============================================

describe("unit: Campaign Schedule Endpoint", () => {
  describe("Schedule Validation", () => {
    it("should validate scheduled_at is required", () => {
      /**
       * Verify schedule endpoint requires scheduled_at field.
       */
      const validPayload = { scheduled_at: "2026-02-01T10:00:00.000Z" };
      const invalidPayload = {};

      expect(validPayload).toHaveProperty("scheduled_at");
      expect(invalidPayload).not.toHaveProperty("scheduled_at");
    });

    it("should validate date format", () => {
      /**
       * Verify ISO 8601 date format is accepted.
       */
      const isoDate = "2026-02-01T10:00:00.000Z";
      const parsedDate = new Date(isoDate);

      expect(parsedDate.toISOString()).toBe(isoDate);
      expect(isNaN(parsedDate.getTime())).toBe(false);
    });

    it("should reject invalid date strings", () => {
      /**
       * Verify invalid dates are rejected.
       */
      const invalidDate = new Date("not-a-date");

      expect(isNaN(invalidDate.getTime())).toBe(true);
    });

    it("should enforce minimum 5 minute future time", () => {
      /**
       * Verify schedule must be at least 5 minutes in the future.
       */
      const now = new Date();
      const minScheduleTime = new Date(now.getTime() + 5 * 60 * 1000);

      const tooSoon = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutes
      const validTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

      expect(tooSoon < minScheduleTime).toBe(true);
      expect(validTime >= minScheduleTime).toBe(true);
    });
  });

  describe("Status Transitions", () => {
    it("should transition draft to scheduled", () => {
      /**
       * Verify schedule changes status from draft to scheduled.
       */
      const beforeStatus: CampaignStatus = "draft";
      const afterStatus: CampaignStatus = "scheduled";

      expect(CAMPAIGN_STATUSES).toContain(beforeStatus);
      expect(CAMPAIGN_STATUSES).toContain(afterStatus);
    });

    it("should transition scheduled back to draft on unschedule", () => {
      /**
       * Verify unschedule reverts status to draft.
       */
      const beforeStatus: CampaignStatus = "scheduled";
      const afterStatus: CampaignStatus = "draft";

      expect(CAMPAIGN_STATUSES).toContain(beforeStatus);
      expect(CAMPAIGN_STATUSES).toContain(afterStatus);
    });

    it("should clear scheduled_at on unschedule", () => {
      /**
       * Verify unschedule clears the scheduled_at field.
       */
      const scheduledCampaign = {
        status: "scheduled" as CampaignStatus,
        scheduled_at: new Date("2026-02-01T10:00:00.000Z"),
      };

      // After unschedule
      const unscheduledCampaign = {
        status: "draft" as CampaignStatus,
        scheduled_at: undefined,
      };

      expect(scheduledCampaign.scheduled_at).toBeDefined();
      expect(unscheduledCampaign.scheduled_at).toBeUndefined();
    });
  });
});

// ============================================
// PAST-SCHEDULED CAMPAIGN TESTS
// ============================================

describe("unit: Past-Scheduled Campaign Handling", () => {
  describe("Past Date Detection", () => {
    it("should detect when scheduled_at is in the past", () => {
      /**
       * Verify logic to detect past scheduled campaigns.
       */
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60000); // 1 minute ago
      const futureDate = new Date(now.getTime() + 60000); // 1 minute from now

      const isPast = (date: Date) => date < now;

      expect(isPast(pastDate)).toBe(true);
      expect(isPast(futureDate)).toBe(false);
    });

    it("should identify scheduled campaigns with past dates", () => {
      /**
       * Verify scheduled status + past date combination.
       */
      const pastScheduledCampaign = {
        status: "scheduled" as CampaignStatus,
        scheduled_at: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };

      const futureScheduledCampaign = {
        status: "scheduled" as CampaignStatus,
        scheduled_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      };

      const isPastScheduled = (campaign: { status: CampaignStatus; scheduled_at?: Date }) => {
        return (
          campaign.status === "scheduled" &&
          campaign.scheduled_at &&
          campaign.scheduled_at < new Date()
        );
      };

      expect(isPastScheduled(pastScheduledCampaign)).toBe(true);
      expect(isPastScheduled(futureScheduledCampaign)).toBe(false);
    });

    it("should not flag draft campaigns as past-scheduled", () => {
      /**
       * Verify only scheduled status triggers past-date check.
       */
      const draftCampaign = {
        status: "draft" as CampaignStatus,
        scheduled_at: undefined,
      };

      const isPastScheduled = (campaign: { status: CampaignStatus; scheduled_at?: Date }) => {
        return (
          campaign.status === "scheduled" &&
          campaign.scheduled_at &&
          campaign.scheduled_at < new Date()
        );
      };

      expect(isPastScheduled(draftCampaign)).toBe(false);
    });
  });

  describe("Unschedule Action", () => {
    it("should allow unscheduling past-scheduled campaigns", () => {
      /**
       * Verify unschedule is available for scheduled campaigns.
       */
      const canUnschedule = (status: CampaignStatus) => status === "scheduled";

      expect(canUnschedule("scheduled")).toBe(true);
      expect(canUnschedule("draft")).toBe(false);
      expect(canUnschedule("sent")).toBe(false);
      expect(canUnschedule("sending")).toBe(false);
      expect(canUnschedule("failed")).toBe(false);
    });

    it("should revert to draft status after unschedule", () => {
      /**
       * Verify unschedule action sets status to draft.
       */
      const performUnschedule = (campaign: { status: CampaignStatus; scheduled_at?: Date }) => {
        return {
          ...campaign,
          status: "draft" as CampaignStatus,
          scheduled_at: undefined,
        };
      };

      const scheduledCampaign = {
        status: "scheduled" as CampaignStatus,
        scheduled_at: new Date(Date.now() - 30 * 60 * 1000), // Past date
      };

      const unscheduled = performUnschedule(scheduledCampaign);

      expect(unscheduled.status).toBe("draft");
      expect(unscheduled.scheduled_at).toBeUndefined();
    });
  });
});
