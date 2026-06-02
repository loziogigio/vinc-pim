import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { AsyncMultiSelect, type AsyncOption } from "@/components/ui/async-multi-select";

const PAGE: AsyncOption[] = [{ id: "cust_1", label: "Acme Spa" }, { id: "cust_2", label: "Beta Srl" }];

function Harness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <AsyncMultiSelect value={value} onChange={setValue} placeholder="Search customers"
      fetchPage={vi.fn(async (q: string) => ({ items: PAGE.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())), hasMore: false }))} />
  );
}

describe("AsyncMultiSelect", () => {
  it("searches, selects an option, shows a chip", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Search customers"), { target: { value: "acme" } });
    await waitFor(() => expect(screen.getByText("Acme Spa")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Acme Spa"));
    await waitFor(() => expect(screen.getByTestId("ams-chip-cust_1")).toBeInTheDocument());
  });
  it("removing a chip clears it", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Search customers"), { target: { value: "beta" } });
    await waitFor(() => expect(screen.getByText("Beta Srl")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Beta Srl"));
    fireEvent.click(await screen.findByTestId("ams-remove-cust_2"));
    await waitFor(() => expect(screen.queryByTestId("ams-chip-cust_2")).toBeNull());
  });
});
