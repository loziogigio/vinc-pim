import { render, screen } from "@testing-library/react";
import { ProductSection } from "@/components/blocks/ProductSection";
import { CategorySection } from "@/components/blocks/CategorySection";
import type { ProductBlockConfig, CategoryBlockConfig } from "@/lib/types/blocks";

const productConfig: ProductBlockConfig = {
  variant: "slider",
  title: "Featured",
  subtitle: "",
  collection: "featured",
  limit: 5,
  columns: { mobile: 1, tablet: 2, desktop: 4 },
  showBadges: true,
  showQuickAdd: true,
  slidesPerView: 4,
  spaceBetween: 24
};

const categoryConfig: CategoryBlockConfig = {
  variant: "grid",
  title: "Categories",
  categories: [
    { id: "hydronics", name: "Hydronic Heating" },
    { id: "bathroom", name: "Bathroom Suites" }
  ],
  layout: "grid",
  columns: { mobile: 2, tablet: 2, desktop: 4 },
  showImage: true,
  showCount: false,
  imageAspectRatio: "1:1"
};

describe("Block components", () => {
  it("limits product slider to five cards", () => {
    render(<ProductSection config={productConfig} />);
    const buttons = screen.getAllByRole("button", { name: /add to cart/i });
    expect(buttons).toHaveLength(productConfig.limit);
  });

  it("renders provided categories", () => {
    render(<CategorySection config={categoryConfig} />);
    expect(screen.getByText("Hydronic Heating")).toBeInTheDocument();
    expect(screen.getByText("Bathroom Suites")).toBeInTheDocument();
  });
});
