import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageTabs } from "@/components/common/LanguageTabs";

const langs = [
  { code: "it", name: "Italian", nativeName: "Italiano", isDefault: true, isEnabled: true, direction: "ltr" as const, flag: "🇮🇹" },
  { code: "de", name: "German", nativeName: "Deutsch", isDefault: false, isEnabled: true, direction: "ltr" as const, flag: "🇩🇪" },
];

describe("LanguageTabs", () => {
  it("renders a tab per language and fires onChange", () => {
    const onChange = vi.fn();
    render(<LanguageTabs languages={langs} active="it" onChange={onChange} />);
    expect(screen.getByText("Italiano")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Deutsch"));
    expect(onChange).toHaveBeenCalledWith("de");
  });
  it("shows a per-tab badge when countFor returns a positive number", () => {
    render(<LanguageTabs languages={langs} active="it" onChange={() => {}} countFor={(c) => (c === "it" ? 3 : 0)} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
