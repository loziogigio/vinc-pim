import { render, screen } from "@testing-library/react";
import StorefrontPage from "@/app/page";

describe("StorefrontPage", () => {
  it("shows plumbing focused categories", () => {
    render(<StorefrontPage />);
    expect(screen.getAllByText("Pipe Fittings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bath Furniture").length).toBeGreaterThan(0);
  });

  it("limits best seller products to five cards", () => {
    render(<StorefrontPage />);
    const addToCartButtons = screen.getAllByRole("button", { name: /add to cart/i });
    expect(addToCartButtons).toHaveLength(5);
  });
});
