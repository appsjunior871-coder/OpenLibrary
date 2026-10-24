/**
 * Server-side PDF inspection and text extraction built on pdf.js (legacy build for Node).
 * The original file is only read; it is never rewritten.
 */
export const EXTRACTOR_NAME = "pdfjs";
export const EXTRACTOR_VERSION = "1";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      // In Node there is no DOM worker: pdf.js falls back to its in-process "fake worker".
      // Pointing workerSrc at the bundled worker keeps that fallback silent and deterministic.
      try {
        mod.GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";
      } catch {
        /* ignore */
      }
      return mod;
    });
  }
  return pdfjsPromise;
}

async function openDocument(buffer: Buffer) {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await task.promise;
  return { doc, destroy: () => task.destroy() };
}

export type PdfInspection = {
  pageCount: number;
  title: string | null;
  author: string | null;
  hasTextLayer: boolean;
};

export function looksLikePdf(buffer: Buffer): boolean {
  // Allow a small amount of leading junk (some generators emit a BOM / whitespace).
  const head = buffer.subarray(0, 1024).toString("latin1");
  return head.includes("%PDF-");
}

/** Validates the file structure and reads basic metadata. Throws when the PDF cannot be parsed. */
export async function inspectPdf(buffer: Buffer): Promise<PdfInspection> {
  if (!looksLikePdf(buffer)) throw new Error("Le fichier n'est pas un PDF valide.");
  const { doc, destroy } = await openDocument(buffer);
  try {
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    // Sample the first pages to detect a text layer.
    let hasTextLayer = false;
    const sample = Math.min(doc.numPages, 3);
    for (let p = 1; p <= sample && !hasTextLayer; p++) {
      const text = await extractPageTextFromDoc(doc, p);
      if (text.trim().length > 20) hasTextLayer = true;
    }
    return {
      pageCount: doc.numPages,
      title: typeof info.Title === "string" && info.Title.trim() ? info.Title.trim() : null,
      author: typeof info.Author === "string" && info.Author.trim() ? info.Author.trim() : null,
      hasTextLayer,
    };
  } finally {
    await destroy();
  }
}

type TextItemLike = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };

/**
 * Rebuilds readable paragraphs from pdf.js text items:
 *  - items on the same baseline are joined with spaces,
 *  - a vertical gap creates a line break, a large gap a paragraph break,
 *  - hyphenated line endings are re-joined.
 */
export function reconstructText(items: TextItemLike[]): string {
  const lines: { y: number; x: number; height: number; text: string }[] = [];
  let current: { y: number; x: number; height: number; parts: string[] } | null = null;

  for (const item of items) {
    const str = item.str;
    if (!str) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const h = Math.max(Math.abs(item.transform[3]) || 0, item.height || 0) || 10;
    if (!current) {
      current = { y, x, height: h, parts: [str] };
      continue;
    }
    const sameLine = Math.abs(current.y - y) < Math.max(2, current.height * 0.5);
    if (sameLine) {
      current.parts.push(str);
    } else {
      lines.push({ ...current, text: current.parts.join("") });
      current = { y, x, height: h, parts: [str] };
    }
    if (item.hasEOL && current) {
      lines.push({ ...current, text: current.parts.join("") });
      current = null;
    }
  }
  if (current) lines.push({ ...current, text: current.parts.join("") });

  const paragraphs: string[] = [];
  let buffer = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const prev = lines[i - 1];
    const gap = prev ? prev.y - line.y : 0;
    const paragraphBreak = prev && gap > Math.max(prev.height, line.height) * 1.6;
    if (paragraphBreak && buffer) {
      paragraphs.push(buffer.trim());
      buffer = "";
    }
    if (buffer.endsWith("-") && /^[a-zà-ÿ]/i.test(text)) {
      buffer = buffer.slice(0, -1) + text;
    } else {
      buffer = buffer ? `${buffer} ${text}` : text;
    }
  }
  if (buffer.trim()) paragraphs.push(buffer.trim());
  return paragraphs.join("\n\n");
}

type LoadedDoc = Awaited<ReturnType<typeof openDocument>>["doc"];

async function extractPageTextFromDoc(doc: LoadedDoc, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    const items = content.items.filter((i) => "str" in i) as unknown as TextItemLike[];
    return reconstructText(items);
  } finally {
    page.cleanup();
  }
}

/** Extract the text of a set of pages. Returns a map page → text ("" when no text layer). */
export async function extractPagesText(buffer: Buffer, pages: number[]): Promise<Map<number, string>> {
  const { doc, destroy } = await openDocument(buffer);
  const result = new Map<number, string>();
  try {
    for (const p of pages) {
      if (p < 1 || p > doc.numPages) continue;
      result.set(p, await extractPageTextFromDoc(doc, p));
    }
    return result;
  } finally {
    await destroy();
  }
}

/** Splits page text into translation segments (paragraphs), keeping order. */
export function segmentText(text: string, maxSegmentChars = 1500): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const segments: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= maxSegmentChars) {
      segments.push(p);
      continue;
    }
    // Long paragraph: split on sentence boundaries.
    let chunk = "";
    for (const sentence of p.split(/(?<=[.!?؟。])\s+/)) {
      if ((chunk + " " + sentence).length > maxSegmentChars && chunk) {
        segments.push(chunk.trim());
        chunk = sentence;
      } else {
        chunk = chunk ? `${chunk} ${sentence}` : sentence;
      }
    }
    if (chunk.trim()) segments.push(chunk.trim());
  }
  return segments;
}

/** Heuristic: is there enough real text to be worth translating? */
export function isTranslatableText(text: string): boolean {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  return letters >= 20;
}
