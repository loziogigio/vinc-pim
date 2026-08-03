import { describe, it, expect } from "vitest";
import { buildCsv, escapeCsvValue } from "@/lib/utils/csv";
import { resolveCsvDelimiter, FORM_EXPORT_MAX_ROWS } from "@/lib/constants/form-export";

const BOM = "﻿";

describe("escapeCsvValue", () => {
  it("returns plain values untouched", () => {
    expect(escapeCsvValue("hello", ";")).toBe("hello");
  });

  it("renders null and undefined as an empty string", () => {
    expect(escapeCsvValue(null, ";")).toBe("");
    expect(escapeCsvValue(undefined, ";")).toBe("");
  });

  it("quotes a value containing the active delimiter only", () => {
    expect(escapeCsvValue("a;b", ";")).toBe('"a;b"');
    expect(escapeCsvValue("a;b", ",")).toBe("a;b");
    expect(escapeCsvValue("a,b", ",")).toBe('"a,b"');
  });

  it("quotes values containing quotes, CR or LF and doubles inner quotes", () => {
    expect(escapeCsvValue('say "hi"', ";")).toBe('"say ""hi"""');
    expect(escapeCsvValue("line1\nline2", ";")).toBe('"line1\nline2"');
    expect(escapeCsvValue("line1\rline2", ";")).toBe('"line1\rline2"');
  });

  it("neutralises formula injection by prefixing an apostrophe", () => {
    expect(escapeCsvValue("=1+1", ";")).toBe("'=1+1");
    expect(escapeCsvValue("+1", ";")).toBe("'+1");
    expect(escapeCsvValue("-1", ";")).toBe("'-1");
    expect(escapeCsvValue("@SUM(A1)", ";")).toBe("'@SUM(A1)");
  });

  it("quotes AND prefixes a dangerous value that also needs quoting", () => {
    expect(escapeCsvValue('=cmd|"x"', ";")).toBe(`"'=cmd|""x"""`);
  });

  it("serialises objects and arrays as JSON", () => {
    expect(escapeCsvValue({ a: 1 }, ";")).toBe('"{""a"":1}"');
    expect(escapeCsvValue([1, 2], ";")).toBe('"[1,2]"');
  });

  it("stringifies booleans and numbers", () => {
    expect(escapeCsvValue(true, ";")).toBe("true");
    expect(escapeCsvValue(0, ";")).toBe("0");
  });
});

describe("buildCsv", () => {
  const columns = [
    { key: "name", header: "Name" },
    { key: "note", header: "Note" },
  ];

  it("emits a BOM, CRLF line endings and semicolons by default", () => {
    const csv = buildCsv({ columns, rows: [{ name: "Ada", note: "hi" }] });
    expect(csv).toBe(`${BOM}Name;Note\r\nAda;hi`);
  });

  it("honours the comma delimiter and omits the BOM when asked", () => {
    const csv = buildCsv({ columns, rows: [{ name: "Ada", note: "hi" }], delimiter: ",", bom: false });
    expect(csv).toBe("Name,Note\r\nAda,hi");
  });

  it("emits a header-only file for zero rows", () => {
    expect(buildCsv({ columns, rows: [] })).toBe(`${BOM}Name;Note`);
  });

  it("leaves missing keys as empty cells", () => {
    const csv = buildCsv({ columns, rows: [{ name: "Ada" }] });
    expect(csv).toBe(`${BOM}Name;Note\r\nAda;`);
  });

  it("escapes headers as well as cells", () => {
    const csv = buildCsv({ columns: [{ key: "a", header: "x;y" }], rows: [] });
    expect(csv).toBe(`${BOM}"x;y"`);
  });
});

describe("resolveCsvDelimiter", () => {
  it("maps the wire words to characters", () => {
    expect(resolveCsvDelimiter("comma")).toBe(",");
    expect(resolveCsvDelimiter("semicolon")).toBe(";");
  });

  it("defaults to semicolon for anything unrecognised", () => {
    expect(resolveCsvDelimiter(undefined)).toBe(";");
    expect(resolveCsvDelimiter("tab")).toBe(";");
    expect(resolveCsvDelimiter(42)).toBe(";");
  });
});

describe("FORM_EXPORT_MAX_ROWS", () => {
  it("is 10000", () => {
    expect(FORM_EXPORT_MAX_ROWS).toBe(10000);
  });
});
