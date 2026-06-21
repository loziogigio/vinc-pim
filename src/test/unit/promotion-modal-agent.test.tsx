import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PromotionModal } from "@/components/pim/PromotionModal";

function mockFetch() {
  return vi.fn((url: string) => {
    if (url.includes("/api/b2b/agent-codes")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          agents: [{ full_tag: "agente:m01", code: "m01", name: "Mario", customer_count: 3 }],
        }),
      });
    }
    // customer-tags
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
  });
}

describe("unit: PromotionModal agent section", () => {
  beforeEach(() => { vi.stubGlobal("fetch", mockFetch()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("renders an Agent section listing assigned agents", async () => {
    render(
      <PromotionModal
        open={true}
        promotion={null}
        packagingPkgIds={[]}
        packagingOptions={[]}
        defaultLanguageCode="it"
        onSave={() => {}}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText("Agent")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Mario/)).toBeInTheDocument(),
    );
  });

  it("shows an existing agent chip from tag_filter", async () => {
    render(
      <PromotionModal
        open={true}
        promotion={{
          promo_code: "X", is_active: true, promo_type: "STD", label: {},
          is_stackable: false, priority: 1, tag_filter: ["agente:m01"],
        }}
        packagingPkgIds={[]}
        packagingOptions={[]}
        defaultLanguageCode="it"
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    // chip label resolves the agent name once agents load
    await waitFor(() => expect(screen.getAllByText(/Mario|agente:m01/).length).toBeGreaterThan(0));
  });
});
