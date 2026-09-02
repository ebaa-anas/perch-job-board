import { describe, expect, it } from "vitest";

import { pickFreeSlug } from "@/lib/slug";
import { slugify } from "@/lib/slug";

describe("pickFreeSlug", () => {
  it("returns the root when it is free", () => {
    expect(pickFreeSlug("northwind-labs", new Set())).toBe("northwind-labs");
  });

  it("suffixes with the first free integer", () => {
    expect(pickFreeSlug("acme", new Set(["acme"]))).toBe("acme-2");
    expect(pickFreeSlug("acme", new Set(["acme", "acme-2", "acme-3"]))).toBe(
      "acme-4",
    );
  });

  it("falls back to a non-empty root", () => {
    expect(pickFreeSlug("", new Set())).toBe("item");
  });
});

describe("slugify", () => {
  it("normalises to lowercase kebab-case ascii", () => {
    expect(slugify("Northwind Labs")).toBe("northwind-labs");
    expect(slugify("  Café  Déjà Vu!! ")).toBe("cafe-deja-vu");
    expect(slugify("A/B — Testing & Co.")).toBe("a-b-testing-co");
  });

  it("trims leading/trailing separators", () => {
    expect(slugify("--hello--")).toBe("hello");
  });
});
