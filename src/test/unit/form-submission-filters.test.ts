import { describe, it, expect } from "vitest";
import {
  parseSubmissionFilters,
  buildSubmissionQuery,
  buildSubmissionCsvColumns,
  toSubmissionCsvRow,
  type SubmissionCsvLabels,
} from "@/lib/services/form-submission.service";

describe("parseSubmissionFilters", () => {
  it("reads every supported param from URLSearchParams", () => {
    const params = new URLSearchParams({
      page_slug: "contact",
      form_type: "standalone",
      ip: "10.0.0.1",
      email: "ada@example.com",
      seen: "unseen",
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
    expect(parseSubmissionFilters(params)).toEqual({
      page_slug: "contact",
      form_type: "standalone",
      ip: "10.0.0.1",
      email: "ada@example.com",
      seen: false,
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
  });

  it("reads the same shape from a plain object body", () => {
    expect(parseSubmissionFilters({ seen: "seen", email: "  ada@example.com  " })).toEqual({
      seen: true,
      email: "ada@example.com",
    });
  });

  it("accepts a real boolean for seen", () => {
    expect(parseSubmissionFilters({ seen: true })).toEqual({ seen: true });
    expect(parseSubmissionFilters({ seen: false })).toEqual({ seen: false });
  });

  it("drops empty, blank and unknown values", () => {
    const params = new URLSearchParams({ page_slug: "", ip: "   ", nonsense: "x" });
    expect(parseSubmissionFilters(params)).toEqual({});
  });

  it("ignores an unrecognised form_type and seen value", () => {
    expect(parseSubmissionFilters({ form_type: "bogus", seen: "maybe" })).toEqual({});
  });

  it("ignores malformed dates", () => {
    expect(parseSubmissionFilters({ date_from: "01/02/2026", date_to: "2026-13-45" })).toEqual({});
  });

  it("rejects dates with day overflow (Feb 30)", () => {
    expect(parseSubmissionFilters({ date_from: "2026-02-30" })).toEqual({});
  });

  it("rejects dates with day overflow (Apr 31)", () => {
    expect(parseSubmissionFilters({ date_to: "2026-04-31" })).toEqual({});
  });

  it("rejects non-leap-year Feb 29", () => {
    expect(parseSubmissionFilters({ date_from: "2026-02-29" })).toEqual({});
  });

  it("accepts valid leap-year Feb 29", () => {
    expect(parseSubmissionFilters({ date_from: "2024-02-29" })).toEqual({ date_from: "2024-02-29" });
  });
});

describe("buildSubmissionQuery", () => {
  it("always applies the scope key", () => {
    expect(buildSubmissionQuery("storefront_slug", "demo", {})).toEqual({
      storefront_slug: "demo",
    });
    expect(buildSubmissionQuery("portal_slug", "default", {})).toEqual({
      portal_slug: "default",
    });
  });

  it("matches page_slug, ip and email as case-insensitive substrings", () => {
    const query = buildSubmissionQuery("storefront_slug", "demo", {
      page_slug: "cont",
      ip: "10.0",
      email: "ADA",
    });
    expect(query.page_slug).toEqual({ $regex: "cont", $options: "i" });
    expect(query.ip_address).toEqual({ $regex: "10\\.0", $options: "i" });
    expect(query.submitter_email).toEqual({ $regex: "ADA", $options: "i" });
  });

  it("matches form_type exactly", () => {
    const query = buildSubmissionQuery("portal_slug", "default", { form_type: "page_form" });
    expect(query.form_type).toBe("page_form");
  });

  it("maps seen to a boolean field", () => {
    expect(buildSubmissionQuery("portal_slug", "d", { seen: true }).seen).toBe(true);
    expect(buildSubmissionQuery("portal_slug", "d", { seen: false }).seen).toBe(false);
  });

  it("bounds created_at on UTC day boundaries", () => {
    const query = buildSubmissionQuery("storefront_slug", "demo", {
      date_from: "2026-01-01",
      date_to: "2026-01-31",
    });
    expect(query.created_at).toEqual({
      $gte: new Date("2026-01-01T00:00:00.000Z"),
      $lte: new Date("2026-01-31T23:59:59.999Z"),
    });
  });

  it("supports an open-ended range on either side", () => {
    expect(
      buildSubmissionQuery("storefront_slug", "demo", { date_from: "2026-01-01" }).created_at
    ).toEqual({ $gte: new Date("2026-01-01T00:00:00.000Z") });
    expect(
      buildSubmissionQuery("storefront_slug", "demo", { date_to: "2026-01-31" }).created_at
    ).toEqual({ $lte: new Date("2026-01-31T23:59:59.999Z") });
  });

  it("omits created_at entirely when no dates are given", () => {
    expect(buildSubmissionQuery("storefront_slug", "demo", {}).created_at).toBeUndefined();
  });
});

const LABELS: SubmissionCsvLabels = {
  submitted_at: "Submitted",
  form: "Form",
  form_type: "Type",
  page_slug: "Page",
  submitter_email: "Email",
  ip_address: "IP",
  seen: "Seen",
  yes: "Yes",
  no: "No",
  page_form: "Page Form",
  standalone: "Standalone",
};

const META_KEYS = [
  "submitted_at",
  "form",
  "form_type",
  "page_slug",
  "submitter_email",
  "ip_address",
  "seen",
];

describe("buildSubmissionCsvColumns", () => {
  it("emits the seven meta columns first, with translated headers", () => {
    const columns = buildSubmissionCsvColumns([], [], LABELS);
    expect(columns.map((c) => c.key)).toEqual(META_KEYS);
    expect(columns[0].header).toBe("Submitted");
    expect(columns[6].header).toBe("Seen");
  });

  it("orders data columns by the definition's field order and uses field labels", () => {
    const submissions = [
      { form_definition_slug: "contact", data: { message: "hi", full_name: "Ada" } },
    ];
    const definitions = [
      {
        slug: "contact",
        config: {
          fields: [
            { id: "full_name", label: "Full name" },
            { id: "message", label: "Message" },
          ],
        },
      },
    ];
    const columns = buildSubmissionCsvColumns(submissions, definitions, LABELS);
    expect(columns.slice(7).map((c) => c.key)).toEqual(["data.full_name", "data.message"]);
    expect(columns.slice(7).map((c) => c.header)).toEqual(["Full name", "Message"]);
  });

  it("appends keys with no matching field alphabetically, humanising the header", () => {
    const submissions = [{ data: { zeta: 1, alpha_key: 2 } }];
    const columns = buildSubmissionCsvColumns(submissions, [], LABELS);
    expect(columns.slice(7).map((c) => c.key)).toEqual(["data.alpha_key", "data.zeta"]);
    expect(columns[7].header).toBe("alpha key");
  });

  it("unions keys across submissions from different forms, definitions first", () => {
    const submissions = [
      { form_definition_slug: "contact", data: { email: "a@b.c" } },
      { form_definition_slug: "demo", data: { company: "Acme" } },
      { data: { loose: true } },
    ];
    const definitions = [
      { slug: "demo", config: { fields: [{ id: "company", label: "Company" }] } },
      { slug: "contact", config: { fields: [{ id: "email", label: "Email address" }] } },
    ];
    const columns = buildSubmissionCsvColumns(submissions, definitions, LABELS);
    // definitions sorted by slug: contact then demo; then leftovers alphabetically
    expect(columns.slice(7).map((c) => c.key)).toEqual([
      "data.email",
      "data.company",
      "data.loose",
    ]);
  });

  it("never emits a duplicate column when two forms share a field id", () => {
    const submissions = [
      { form_definition_slug: "a", data: { email: "x" } },
      { form_definition_slug: "b", data: { email: "y" } },
    ];
    const definitions = [
      { slug: "a", config: { fields: [{ id: "email", label: "Email A" }] } },
      { slug: "b", config: { fields: [{ id: "email", label: "Email B" }] } },
    ];
    const columns = buildSubmissionCsvColumns(submissions, definitions, LABELS);
    const dataColumns = columns.slice(7);
    expect(dataColumns).toHaveLength(1);
    expect(dataColumns[0].header).toBe("Email A");
  });

  it("omits definition fields that no exported submission actually used", () => {
    const submissions = [{ form_definition_slug: "contact", data: { email: "a@b.c" } }];
    const definitions = [
      {
        slug: "contact",
        config: { fields: [{ id: "email", label: "Email" }, { id: "phone", label: "Phone" }] },
      },
    ];
    const columns = buildSubmissionCsvColumns(submissions, definitions, LABELS);
    expect(columns.slice(7).map((c) => c.key)).toEqual(["data.email"]);
  });
});

describe("toSubmissionCsvRow", () => {
  const columns = buildSubmissionCsvColumns(
    [{ form_definition_slug: "contact", data: { email: "a@b.c" } }],
    [{ slug: "contact", config: { fields: [{ id: "email", label: "Email" }] } }],
    LABELS
  );

  it("renders created_at as an ISO-8601 UTC string", () => {
    const row = toSubmissionCsvRow(
      { created_at: new Date("2026-02-03T10:11:12.000Z") },
      columns,
      LABELS
    );
    expect(row.submitted_at).toBe("2026-02-03T10:11:12.000Z");
  });

  it("uses the definition slug as the form for standalone submissions", () => {
    const row = toSubmissionCsvRow(
      { form_type: "standalone", form_definition_slug: "demo_request", page_slug: "home" },
      columns,
      LABELS
    );
    expect(row.form).toBe("demo_request");
    expect(row.form_type).toBe("Standalone");
  });

  it("falls back to the page slug as the form for page submissions", () => {
    const row = toSubmissionCsvRow(
      { form_type: "page_form", page_slug: "contatti" },
      columns,
      LABELS
    );
    expect(row.form).toBe("contatti");
    expect(row.form_type).toBe("Page Form");
    expect(row.page_slug).toBe("contatti");
  });

  it("localises seen as yes/no", () => {
    expect(toSubmissionCsvRow({ seen: true }, columns, LABELS).seen).toBe("Yes");
    expect(toSubmissionCsvRow({ seen: false }, columns, LABELS).seen).toBe("No");
  });

  it("flattens data values under their data.* column keys", () => {
    const row = toSubmissionCsvRow({ data: { email: "a@b.c" } }, columns, LABELS);
    expect(row["data.email"]).toBe("a@b.c");
  });

  it("leaves foreign data columns undefined rather than throwing", () => {
    const row = toSubmissionCsvRow({ data: {} }, columns, LABELS);
    expect(row["data.email"]).toBeUndefined();
  });

  it("survives a submission with no data at all", () => {
    expect(() => toSubmissionCsvRow({}, columns, LABELS)).not.toThrow();
  });
});
