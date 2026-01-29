/**
 * Unit Tests for Campaign UI Components Utilities
 */

import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_STATUS_LABELS,
  CHANNEL_LABELS,
  type CampaignStatus,
  type NotificationChannel,
} from "@/lib/constants/notification";

// ============================================
// STATUS BADGE TESTS
// ============================================

describe("unit: Campaign Status Labels", () => {
  it("should have labels for all statuses", () => {
    const statuses: CampaignStatus[] = ["draft", "scheduled", "sending", "sent", "failed"];

    statuses.forEach((status) => {
      expect(CAMPAIGN_STATUS_LABELS[status]).toBeDefined();
      expect(typeof CAMPAIGN_STATUS_LABELS[status]).toBe("string");
      expect(CAMPAIGN_STATUS_LABELS[status].length).toBeGreaterThan(0);
    });
  });

  it("should have Italian labels", () => {
    expect(CAMPAIGN_STATUS_LABELS.draft).toBe("Bozza");
    expect(CAMPAIGN_STATUS_LABELS.sent).toBe("Inviata");
    expect(CAMPAIGN_STATUS_LABELS.failed).toBe("Fallita");
  });
});

// ============================================
// CHANNEL LABELS TESTS
// ============================================

describe("unit: Channel Labels", () => {
  it("should have labels for all channels", () => {
    const channels: NotificationChannel[] = ["email", "mobile", "web_in_app"];

    channels.forEach((channel) => {
      expect(CHANNEL_LABELS[channel]).toBeDefined();
      expect(typeof CHANNEL_LABELS[channel]).toBe("string");
    });
  });

  it("should have correct labels", () => {
    expect(CHANNEL_LABELS.email).toBe("Email");
    expect(CHANNEL_LABELS.mobile).toBe("Mobile App");
    expect(CHANNEL_LABELS.web_in_app).toBe("Web Push / In-App");
  });
});

// ============================================
// PERCENTAGE FORMATTING TESTS
// ============================================

describe("unit: Percentage Formatting", () => {
  function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  it("should format 0 as 0%", () => {
    expect(formatPercent(0)).toBe("0%");
  });

  it("should format 1 as 100%", () => {
    expect(formatPercent(1)).toBe("100%");
  });

  it("should format 0.5 as 50%", () => {
    expect(formatPercent(0.5)).toBe("50%");
  });

  it("should round percentages", () => {
    expect(formatPercent(0.333)).toBe("33%");
    expect(formatPercent(0.666)).toBe("67%");
    expect(formatPercent(0.125)).toBe("13%");
  });
});

// ============================================
// DATE FORMATTING TESTS
// ============================================

describe("unit: Date Formatting", () => {
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  it("should format ISO date string", () => {
    const result = formatDate("2024-01-15T10:30:00Z");
    // Check it contains expected parts (locale-specific formatting)
    expect(result).toContain("2024");
    expect(result).toContain("15");
  });

  it("should handle different dates", () => {
    const date1 = formatDate("2024-06-01T08:00:00Z");
    const date2 = formatDate("2024-12-25T18:30:00Z");

    expect(date1).toContain("2024");
    expect(date2).toContain("2024");
    expect(date2).toContain("25");
  });
});

// ============================================
// RESULTS CALCULATION TESTS
// ============================================

describe("unit: Results Calculations", () => {
  interface ChannelResults {
    sent: number;
    failed: number;
    opened?: number;
    clicked?: number;
  }

  function calculateDeliveryRate(results: ChannelResults): number {
    const total = results.sent + results.failed;
    return total > 0 ? results.sent / total : 0;
  }

  function calculateOpenRate(results: ChannelResults): number | undefined {
    if (results.opened === undefined) return undefined;
    return results.sent > 0 ? results.opened / results.sent : 0;
  }

  function calculateClickRate(results: ChannelResults): number | undefined {
    if (results.clicked === undefined) return undefined;
    return results.sent > 0 ? results.clicked / results.sent : 0;
  }

  it("should calculate delivery rate correctly", () => {
    expect(calculateDeliveryRate({ sent: 90, failed: 10 })).toBe(0.9);
    expect(calculateDeliveryRate({ sent: 100, failed: 0 })).toBe(1);
    expect(calculateDeliveryRate({ sent: 0, failed: 100 })).toBe(0);
    expect(calculateDeliveryRate({ sent: 0, failed: 0 })).toBe(0);
  });

  it("should calculate open rate correctly", () => {
    expect(calculateOpenRate({ sent: 100, failed: 0, opened: 50 })).toBe(0.5);
    expect(calculateOpenRate({ sent: 100, failed: 0, opened: 0 })).toBe(0);
    expect(calculateOpenRate({ sent: 0, failed: 0, opened: 0 })).toBe(0);
    expect(calculateOpenRate({ sent: 100, failed: 0 })).toBeUndefined();
  });

  it("should calculate click rate correctly", () => {
    expect(calculateClickRate({ sent: 100, failed: 0, clicked: 25 })).toBe(0.25);
    expect(calculateClickRate({ sent: 100, failed: 0, clicked: 0 })).toBe(0);
    expect(calculateClickRate({ sent: 100, failed: 0 })).toBeUndefined();
  });
});

// ============================================
// CAMPAIGN LIST FILTER TESTS
// ============================================

describe("unit: Campaign List Filters", () => {
  interface Campaign {
    campaign_id: string;
    name: string;
    status: CampaignStatus;
  }

  const mockCampaigns: Campaign[] = [
    { campaign_id: "1", name: "Campaign A", status: "draft" },
    { campaign_id: "2", name: "Campaign B", status: "sent" },
    { campaign_id: "3", name: "Campaign C", status: "draft" },
    { campaign_id: "4", name: "Campaign D", status: "failed" },
    { campaign_id: "5", name: "Test Search", status: "sent" },
  ];

  function filterByStatus(campaigns: Campaign[], status: CampaignStatus | "all"): Campaign[] {
    if (status === "all") return campaigns;
    return campaigns.filter((c) => c.status === status);
  }

  function filterBySearch(campaigns: Campaign[], search: string): Campaign[] {
    if (!search) return campaigns;
    const lower = search.toLowerCase();
    return campaigns.filter((c) => c.name.toLowerCase().includes(lower));
  }

  it("should filter by status", () => {
    expect(filterByStatus(mockCampaigns, "draft")).toHaveLength(2);
    expect(filterByStatus(mockCampaigns, "sent")).toHaveLength(2);
    expect(filterByStatus(mockCampaigns, "failed")).toHaveLength(1);
    expect(filterByStatus(mockCampaigns, "all")).toHaveLength(5);
  });

  it("should filter by search", () => {
    expect(filterBySearch(mockCampaigns, "Campaign")).toHaveLength(4);
    expect(filterBySearch(mockCampaigns, "test")).toHaveLength(1);
    expect(filterBySearch(mockCampaigns, "xyz")).toHaveLength(0);
    expect(filterBySearch(mockCampaigns, "")).toHaveLength(5);
  });

  it("should combine filters", () => {
    const byStatus = filterByStatus(mockCampaigns, "sent");
    const combined = filterBySearch(byStatus, "test");
    expect(combined).toHaveLength(1);
    expect(combined[0].name).toBe("Test Search");
  });
});

// ============================================
// PAGINATION TESTS
// ============================================

describe("unit: Pagination", () => {
  function paginate<T>(items: T[], page: number, limit: number): T[] {
    const start = (page - 1) * limit;
    return items.slice(start, start + limit);
  }

  function calculateTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("should paginate correctly", () => {
    expect(paginate(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginate(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it("should calculate total pages", () => {
    expect(calculateTotalPages(25, 10)).toBe(3);
    expect(calculateTotalPages(20, 10)).toBe(2);
    expect(calculateTotalPages(10, 10)).toBe(1);
    expect(calculateTotalPages(0, 10)).toBe(0);
  });

  it("should handle edge cases", () => {
    expect(paginate(items, 10, 10)).toEqual([]); // Beyond range
    expect(paginate([], 1, 10)).toEqual([]); // Empty array
  });
});
