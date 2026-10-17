/**
 * A one-page PDF built from lines of text, so every seeded seeker has a real
 * file behind "Download CV" without a binary checked into the repository.
 *
 * Uses the built-in Helvetica, which means WinAnsi text only: anything outside
 * printable ASCII is folded to its closest letter first (İ → I, ş → s). That
 * also keeps string length equal to byte length, which the xref offsets need.
 */

const PAGE_WIDTH = 595; // A4, in points
const PAGE_HEIGHT = 842;

export function toPdfText(value: string): string {
  return value
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[·•]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[\\()]/g, (c) => `\\${c}`);
}

/** First line is set as a title; the rest as body text, one per line. */
export function buildCvPdf(lines: readonly string[]): Uint8Array {
  const [title = "", ...body] = lines.map(toPdfText);
  const ops = [
    "BT",
    "15 TL",
    `56 ${PAGE_HEIGHT - 64} Td`,
    "/F1 18 Tf",
    `(${title}) Tj`,
    "/F1 10.5 Tf",
    "T*",
    "T*",
    ...body.flatMap((line) => [`(${line}) Tj`, "T*"]),
    "ET",
  ];
  const stream = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
