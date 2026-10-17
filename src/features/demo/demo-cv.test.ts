import { describe, expect, it } from "vitest";

import { buildCvPdf, toPdfText } from "@/features/demo/demo-cv";

const decode = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("toPdfText", () => {
  it("folds Turkish and typographic characters to ASCII", () => {
    expect(toPdfText("İstanbul, Türkiye — Kadıköy · Şişli")).toBe(
      "Istanbul, Turkiye - Kadikoy - Sisli",
    );
  });

  it("escapes the characters that would end a PDF string early", () => {
    expect(toPdfText("Next.js (App Router) \\ edge")).toBe(
      "Next.js \\(App Router\\) \\\\ edge",
    );
  });
});

describe("buildCvPdf", () => {
  const pdf = decode(buildCvPdf(["Deniz Aksoy", "Frontend (React) · İstanbul", "Skills: TypeScript"]));

  it("is a complete PDF document", () => {
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("is pure ASCII, so string offsets are byte offsets", () => {
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(pdf)).toBe(true);
  });

  it("has an xref table whose every entry points at its object", () => {
    const startxref = Number(pdf.match(/startxref\n(\d+)\n/)?.[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");

    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    expect(entries).toHaveLength(5);
    entries.forEach((offset, index) => {
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });

  it("declares the content stream's real length", () => {
    const declared = Number(pdf.match(/<< \/Length (\d+) >>\nstream\n/)?.[1]);
    // Lazy match: "endstream" itself contains "stream", so a split would overrun.
    const body = pdf.match(/\nstream\n([\s\S]*?)\nendstream/)?.[1] ?? "";
    expect(body.length).toBe(declared);
  });

  it("carries the text, escaped", () => {
    expect(pdf).toContain("(Deniz Aksoy) Tj");
    expect(pdf).toContain("(Frontend \\(React\\) - Istanbul) Tj");
  });
});
