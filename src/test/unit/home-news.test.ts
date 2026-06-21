import { describe, it, expect } from "vitest";
import { mergeNews, formatNewsDate, pickLang, type HomeNewsItem } from "@/lib/services/blog/home-news";

function item(id: string, source: "local" | "central", publishedAt: string | null): HomeNewsItem {
  return {
    id,
    source,
    title: id,
    excerpt: null,
    category: null,
    coverUrl: null,
    publishedAt,
    dateLabel: "",
    href: "#",
    external: source === "central",
  };
}

describe("mergeNews", () => {
  it("interleaves both sources newest-first", () => {
    const local = [
      item("l1", "local", "2026-06-10T00:00:00Z"),
      item("l2", "local", "2026-06-01T00:00:00Z"),
    ];
    const central = [item("c1", "central", "2026-06-12T00:00:00Z")];
    expect(mergeNews(local, central, 10).map((i) => i.id)).toEqual(["c1", "l1", "l2"]);
  });

  it("caps the result at the limit", () => {
    const local = [
      item("l1", "local", "2026-06-10T00:00:00Z"),
      item("l2", "local", "2026-06-09T00:00:00Z"),
    ];
    const central = [item("c1", "central", "2026-06-12T00:00:00Z")];
    expect(mergeNews(local, central, 2).map((i) => i.id)).toEqual(["c1", "l1"]);
  });

  it("sorts items without a date last and handles empty sources", () => {
    const local = [item("l1", "local", null)];
    const central = [item("c1", "central", "2026-06-12T00:00:00Z")];
    expect(mergeNews(local, central, 10).map((i) => i.id)).toEqual(["c1", "l1"]);
    expect(mergeNews([], [], 5)).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const local = [item("l1", "local", "2026-06-01T00:00:00Z")];
    const central = [item("c1", "central", "2026-06-02T00:00:00Z")];
    mergeNews(local, central, 10);
    expect(local.map((i) => i.id)).toEqual(["l1"]);
    expect(central.map((i) => i.id)).toEqual(["c1"]);
  });
});

describe("formatNewsDate", () => {
  it("returns an empty string for missing or invalid dates", () => {
    expect(formatNewsDate(null, "it")).toBe("");
    expect(formatNewsDate(undefined, "it")).toBe("");
    expect(formatNewsDate("not-a-date", "it")).toBe("");
  });

  it("produces a non-empty label for a valid ISO date", () => {
    expect(formatNewsDate("2026-06-12T00:00:00Z", "it").length).toBeGreaterThan(0);
  });
});

describe("pickLang", () => {
  it("prefers the requested locale, then falls back", () => {
    expect(pickLang({ it: "Ciao", en: "Hello" }, "en")).toBe("Hello");
    expect(pickLang({ it: "Ciao", en: "Hello" }, "it")).toBe("Ciao");
    expect(pickLang({ en: "Hello" }, "it")).toBe("Hello");
    expect(pickLang("plain", "it")).toBe("plain");
    expect(pickLang(null, "it")).toBe("");
  });
});
