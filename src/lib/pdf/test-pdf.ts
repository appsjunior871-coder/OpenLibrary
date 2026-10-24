/**
 * Minimal PDF writer used by tests and the seed script to produce valid,
 * text-bearing PDFs without external dependencies (Helvetica base-14 font).
 * Not meant for production documents.
 */
export function buildSimplePdf(pages: string[][]): Buffer {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const fontObj = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const pagesObjIndex = objects.length + 1; // reserve
  objects.push(""); // placeholder for /Pages

  const pageObjIds: number[] = [];
  for (const lines of pages) {
    const content = buildContentStream(lines);
    const contentObj = addObject(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    const pageObj = addObject(
      `<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`,
    );
    pageObjIds.push(pageObj);
  }
  objects[pagesObjIndex - 1] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`;
  const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesObjIndex} 0 R >>`);
  const infoObj = addObject("<< /Title (OpenLibrary test document) /Author (OpenLibrary) >>");

  let out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function escapePdfString(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContentStream(lines: string[]) {
  // Each entry of `lines` is a paragraph; blank separation uses a larger leading.
  let y = 780;
  const parts: string[] = ["BT", "/F1 11 Tf"];
  for (const paragraph of lines) {
    const wrapped = wrap(paragraph, 90);
    for (const line of wrapped) {
      parts.push(`1 0 0 1 60 ${y} Tm (${escapePdfString(line)}) Tj`);
      y -= 14;
    }
    y -= 14; // paragraph gap
  }
  parts.push("ET");
  return parts.join("\n");
}

function wrap(text: string, width: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else {
      line = `${line} ${w}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** A PDF with a single blank page (no text layer), to simulate a scanned document. */
export function buildImageOnlyPdf(): Buffer {
  return buildSimplePdf([[]]);
}
