/**
 * Unit Tests for Document Constants
 *
 * Tests document types, statuses, transitions, labels, and helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_PREFIXES,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TRANSITIONS,
  DOCUMENT_HISTORY_ACTIONS,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  DEFAULT_NUMBERING_FORMATS,
  DEFAULT_NUMBER_PADDING,
  canTransitionDocument,
  getAllowedDocumentTransitions,
  canEditDocument,
  isTerminalDocumentStatus,
} from "@/lib/constants/document";

// ============================================
// DOCUMENT TYPES
// ============================================

describe("unit: Document Constants - Types", () => {
  it("should have all four document types", () => {
    expect(DOCUMENT_TYPES).toContain("quotation");
    expect(DOCUMENT_TYPES).toContain("proforma");
    expect(DOCUMENT_TYPES).toContain("invoice");
    expect(DOCUMENT_TYPES).toContain("credit_note");
    expect(DOCUMENT_TYPES.length).toBe(4);
  });

  it("should have Italian labels for all document types", () => {
    for (const type of DOCUMENT_TYPES) {
      expect(DOCUMENT_TYPE_LABELS[type]).toBeDefined();
      expect(DOCUMENT_TYPE_LABELS[type]).not.toBe("");
    }
  });

  it("should have correct Italian labels", () => {
    expect(DOCUMENT_TYPE_LABELS.quotation).toBe("Preventivo");
    expect(DOCUMENT_TYPE_LABELS.invoice).toBe("Fattura");
    expect(DOCUMENT_TYPE_LABELS.proforma).toBe("Proforma");
    expect(DOCUMENT_TYPE_LABELS.credit_note).toBe("Nota di Credito");
  });

  it("should have prefixes for all document types", () => {
    for (const type of DOCUMENT_TYPES) {
      expect(DOCUMENT_TYPE_PREFIXES[type]).toBeDefined();
      expect(DOCUMENT_TYPE_PREFIXES[type]).not.toBe("");
    }
  });
});

// ============================================
// DOCUMENT STATUSES
// ============================================

describe("unit: Document Constants - Statuses", () => {
  it("should have all five statuses", () => {
    expect(DOCUMENT_STATUSES).toContain("draft");
    expect(DOCUMENT_STATUSES).toContain("finalized");
    expect(DOCUMENT_STATUSES).toContain("sent");
    expect(DOCUMENT_STATUSES).toContain("paid");
    expect(DOCUMENT_STATUSES).toContain("voided");
    expect(DOCUMENT_STATUSES.length).toBe(5);
  });

  it("should have Italian labels for all statuses", () => {
    for (const status of DOCUMENT_STATUSES) {
      expect(DOCUMENT_STATUS_LABELS[status]).toBeDefined();
      expect(DOCUMENT_STATUS_LABELS[status]).not.toBe("");
    }
  });

  it("should have transitions defined for all statuses", () => {
    for (const status of DOCUMENT_STATUSES) {
      expect(DOCUMENT_STATUS_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(DOCUMENT_STATUS_TRANSITIONS[status])).toBe(true);
    }
  });
});

// ============================================
// STATUS TRANSITIONS
// ============================================

describe("unit: Document Constants - Status Transitions", () => {
  it("draft can only transition to finalized", () => {
    expect(DOCUMENT_STATUS_TRANSITIONS.draft).toEqual(["finalized"]);
  });

  it("finalized can transition to sent or voided", () => {
    expect(DOCUMENT_STATUS_TRANSITIONS.finalized).toContain("sent");
    expect(DOCUMENT_STATUS_TRANSITIONS.finalized).toContain("voided");
    expect(DOCUMENT_STATUS_TRANSITIONS.finalized.length).toBe(2);
  });

  it("sent can transition to paid or voided", () => {
    expect(DOCUMENT_STATUS_TRANSITIONS.sent).toContain("paid");
    expect(DOCUMENT_STATUS_TRANSITIONS.sent).toContain("voided");
    expect(DOCUMENT_STATUS_TRANSITIONS.sent.length).toBe(2);
  });

  it("paid can only transition to voided", () => {
    expect(DOCUMENT_STATUS_TRANSITIONS.paid).toEqual(["voided"]);
  });

  it("voided has no transitions (terminal)", () => {
    expect(DOCUMENT_STATUS_TRANSITIONS.voided).toEqual([]);
  });

  it("canTransitionDocument validates allowed transitions", () => {
    expect(canTransitionDocument("draft", "finalized")).toBe(true);
    expect(canTransitionDocument("finalized", "sent")).toBe(true);
    expect(canTransitionDocument("sent", "paid")).toBe(true);
    expect(canTransitionDocument("paid", "voided")).toBe(true);
  });

  it("canTransitionDocument rejects invalid transitions", () => {
    expect(canTransitionDocument("draft", "sent")).toBe(false);
    expect(canTransitionDocument("draft", "paid")).toBe(false);
    expect(canTransitionDocument("draft", "voided")).toBe(false);
    expect(canTransitionDocument("voided", "draft")).toBe(false);
    expect(canTransitionDocument("sent", "draft")).toBe(false);
    expect(canTransitionDocument("paid", "draft")).toBe(false);
  });

  it("getAllowedDocumentTransitions returns correct arrays", () => {
    expect(getAllowedDocumentTransitions("draft")).toEqual(["finalized"]);
    expect(getAllowedDocumentTransitions("voided")).toEqual([]);
    expect(getAllowedDocumentTransitions("sent").length).toBe(2);
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

describe("unit: Document Constants - Helpers", () => {
  it("canEditDocument returns true only for drafts", () => {
    expect(canEditDocument("draft")).toBe(true);
    expect(canEditDocument("finalized")).toBe(false);
    expect(canEditDocument("sent")).toBe(false);
    expect(canEditDocument("paid")).toBe(false);
    expect(canEditDocument("voided")).toBe(false);
  });

  it("isTerminalDocumentStatus returns true only for voided", () => {
    expect(isTerminalDocumentStatus("voided")).toBe(true);
    expect(isTerminalDocumentStatus("draft")).toBe(false);
    expect(isTerminalDocumentStatus("finalized")).toBe(false);
    expect(isTerminalDocumentStatus("sent")).toBe(false);
    expect(isTerminalDocumentStatus("paid")).toBe(false);
  });
});

// ============================================
// NUMBERING
// ============================================

describe("unit: Document Constants - Numbering", () => {
  it("should have default numbering formats for all types", () => {
    for (const type of DOCUMENT_TYPES) {
      expect(DEFAULT_NUMBERING_FORMATS[type]).toBeDefined();
      expect(DEFAULT_NUMBERING_FORMATS[type]).toContain("{YEAR}");
      expect(DEFAULT_NUMBERING_FORMATS[type]).toContain("{NUMBER}");
    }
  });

  it("should have a positive default padding", () => {
    expect(DEFAULT_NUMBER_PADDING).toBeGreaterThan(0);
    expect(DEFAULT_NUMBER_PADDING).toBe(5);
  });
});

// ============================================
// PAYMENT TERMS
// ============================================

describe("unit: Document Constants - Payment Terms", () => {
  it("should have payment term labels for all terms", () => {
    for (const term of PAYMENT_TERMS) {
      expect(PAYMENT_TERMS_LABELS[term]).toBeDefined();
      expect(PAYMENT_TERMS_LABELS[term]).not.toBe("");
    }
  });

  it("should include common payment terms", () => {
    expect(PAYMENT_TERMS).toContain("immediate");
    expect(PAYMENT_TERMS).toContain("NET30");
    expect(PAYMENT_TERMS).toContain("NET60");
  });
});

// ============================================
// HISTORY ACTIONS
// ============================================

describe("unit: Document Constants - History Actions", () => {
  it("should include all lifecycle actions", () => {
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("created");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("updated");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("finalized");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("sent");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("paid");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("voided");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("duplicated");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("pdf_generated");
    expect(DOCUMENT_HISTORY_ACTIONS).toContain("number_assigned");
  });
});
