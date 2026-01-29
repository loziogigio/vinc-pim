/**
 * Unit Tests: Campaign Model & Constants
 *
 * Tests for campaign status, recipient types, and model validation.
 */

import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  RECIPIENT_TYPES,
  type CampaignStatus,
  type RecipientType,
} from "@/lib/constants/notification";

describe("unit: Campaign Status Constants", () => {
  describe("CAMPAIGN_STATUSES", () => {
    it("should have exactly 5 statuses", () => {
      /**
       * Verify that all 5 campaign statuses are defined.
       * draft, scheduled, sending, sent, failed
       */
      expect(CAMPAIGN_STATUSES).toHaveLength(5);
    });

    it("should include all expected statuses", () => {
      /**
       * Verify status names match expected values.
       */
      expect(CAMPAIGN_STATUSES).toContain("draft");
      expect(CAMPAIGN_STATUSES).toContain("scheduled");
      expect(CAMPAIGN_STATUSES).toContain("sending");
      expect(CAMPAIGN_STATUSES).toContain("sent");
      expect(CAMPAIGN_STATUSES).toContain("failed");
    });

    it("should have draft as first status (default)", () => {
      /**
       * Verify draft is first (used as default status).
       */
      expect(CAMPAIGN_STATUSES[0]).toBe("draft");
    });
  });

  describe("CAMPAIGN_STATUS_LABELS", () => {
    it("should have a label for every status", () => {
      /**
       * Verify each status has a corresponding label.
       */
      CAMPAIGN_STATUSES.forEach((status) => {
        expect(CAMPAIGN_STATUS_LABELS[status]).toBeDefined();
        expect(typeof CAMPAIGN_STATUS_LABELS[status]).toBe("string");
        expect(CAMPAIGN_STATUS_LABELS[status].length).toBeGreaterThan(0);
      });
    });

    it("should have human-readable labels", () => {
      /**
       * Verify labels are user-friendly (Italian).
       */
      expect(CAMPAIGN_STATUS_LABELS.draft).toBe("Bozza");
      expect(CAMPAIGN_STATUS_LABELS.scheduled).toBe("Programmata");
      expect(CAMPAIGN_STATUS_LABELS.sending).toBe("In Invio");
      expect(CAMPAIGN_STATUS_LABELS.sent).toBe("Inviata");
      expect(CAMPAIGN_STATUS_LABELS.failed).toBe("Fallita");
    });

    it("should not have labels for undefined statuses", () => {
      /**
       * Verify no extra labels exist beyond defined statuses.
       */
      const labelKeys = Object.keys(CAMPAIGN_STATUS_LABELS);
      expect(labelKeys.length).toBe(CAMPAIGN_STATUSES.length);
    });
  });
});

describe("unit: Recipient Type Constants", () => {
  describe("RECIPIENT_TYPES", () => {
    it("should have exactly 3 recipient types", () => {
      /**
       * Verify that all 3 recipient types are defined.
       * all, selected, tagged
       */
      expect(RECIPIENT_TYPES).toHaveLength(3);
    });

    it("should include all expected types", () => {
      /**
       * Verify recipient type names match expected values.
       */
      expect(RECIPIENT_TYPES).toContain("all");
      expect(RECIPIENT_TYPES).toContain("selected");
      expect(RECIPIENT_TYPES).toContain("tagged");
    });

    it("should have 'all' as first type (common default)", () => {
      /**
       * Verify 'all' is first (most common use case).
       */
      expect(RECIPIENT_TYPES[0]).toBe("all");
    });
  });
});

describe("unit: Campaign Type Safety", () => {
  it("should allow valid campaign status types", () => {
    /**
     * Verify TypeScript type inference works correctly.
     */
    const validStatus: CampaignStatus = "draft";
    expect(CAMPAIGN_STATUSES).toContain(validStatus);
  });

  it("should allow valid recipient types", () => {
    /**
     * Verify TypeScript type inference works correctly.
     */
    const validRecipient: RecipientType = "selected";
    expect(RECIPIENT_TYPES).toContain(validRecipient);
  });
});

describe("unit: Campaign Status Workflow", () => {
  it("should have logical status progression", () => {
    /**
     * Verify statuses follow logical workflow:
     * draft -> scheduled -> sending -> sent (or failed)
     */
    const draftIndex = CAMPAIGN_STATUSES.indexOf("draft");
    const scheduledIndex = CAMPAIGN_STATUSES.indexOf("scheduled");
    const sendingIndex = CAMPAIGN_STATUSES.indexOf("sending");
    const sentIndex = CAMPAIGN_STATUSES.indexOf("sent");
    const failedIndex = CAMPAIGN_STATUSES.indexOf("failed");

    // All statuses should exist
    expect(draftIndex).toBeGreaterThanOrEqual(0);
    expect(scheduledIndex).toBeGreaterThanOrEqual(0);
    expect(sendingIndex).toBeGreaterThanOrEqual(0);
    expect(sentIndex).toBeGreaterThanOrEqual(0);
    expect(failedIndex).toBeGreaterThanOrEqual(0);

    // Workflow progression (draft before scheduled, scheduled before sending, etc.)
    expect(draftIndex).toBeLessThan(scheduledIndex);
    expect(scheduledIndex).toBeLessThan(sendingIndex);
    expect(sendingIndex).toBeLessThan(sentIndex);
  });
});
