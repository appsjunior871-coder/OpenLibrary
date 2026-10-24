import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/auth/password";
import { reconstructText, segmentText, isTranslatableText, looksLikePdf, inspectPdf, extractPagesText } from "@/lib/pdf/extract";
import { buildSimplePdf, buildImageOnlyPdf } from "@/lib/pdf/test-pdf";
import { canEditDocument, roleHas } from "@/lib/authz/permissions";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import { hashSegment } from "@/lib/services/translation";
import { buildSummaryPrompt } from "@/lib/providers/ai";

describe("Mots de passe", () => {
  it("hache et vérifie avec scrypt, jamais en clair", async () => {
    const hash = await hashPassword("Correct-horse-42");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("Correct-horse-42");
    expect(await verifyPassword("Correct-horse-42", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("applique la politique de robustesse", () => {
    expect(validatePasswordStrength("short1")).not.toBeNull();
    expect(validatePasswordStrength("onlyletterslong")).not.toBeNull();
    expect(validatePasswordStrength("Correct-horse-42")).toBeNull();
  });
});

describe("Permissions", () => {
  it("sépare visiteur / étudiant / contributeur / admin", () => {
    expect(roleHas("student", "translations:use")).toBe(true);
    expect(roleHas("student", "admin:access")).toBe(false);
    expect(roleHas("contributor", "documents:create")).toBe(true);
    expect(roleHas("contributor", "documents:publish")).toBe(false);
    expect(roleHas("contributor", "users:manage")).toBe(false);
    expect(roleHas("admin", "users:manage")).toBe(true);
    expect(canEditDocument("contributor", "u1", "u1")).toBe(true);
    expect(canEditDocument("contributor", "u1", "u2")).toBe(false);
    expect(canEditDocument("admin", "u1", "u2")).toBe(true);
  });
});

describe("Extraction PDF", () => {
  it("reconstruit lignes et paragraphes, ré-assemble les césures", () => {
    const items = [
      { str: "Intro", transform: [1, 0, 0, 1, 50, 700], width: 10, height: 10 },
      { str: "duction", transform: [1, 0, 0, 1, 80, 700], width: 10, height: 10 },
      { str: "to algo-", transform: [1, 0, 0, 1, 50, 688], width: 10, height: 10 },
      { str: "rithms.", transform: [1, 0, 0, 1, 50, 676], width: 10, height: 10 },
      { str: "New paragraph here.", transform: [1, 0, 0, 1, 50, 640], width: 10, height: 10 },
    ];
    const text = reconstructText(items);
    expect(text).toBe("Introduction to algorithms.\n\nNew paragraph here.");
  });
  it("segmente par paragraphe et découpe les paragraphes trop longs", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const segs = segmentText(`First.\n\n${long}`, 200);
    expect(segs[0]).toBe("First.");
    expect(segs.length).toBeGreaterThan(2);
    expect(segs.every((s) => s.length <= 230)).toBe(true);
  });
  it("détecte le texte traduisible et les PDF", async () => {
    expect(isTranslatableText("12 34 56")).toBe(false);
    expect(isTranslatableText("This is a sentence with enough letters.")).toBe(true);
    expect(looksLikePdf(Buffer.from("%PDF-1.4 ..."))).toBe(true);
    expect(looksLikePdf(Buffer.from("GIF89a"))).toBe(false);
    const pdf = buildSimplePdf([["Hello world from OpenLibrary tests."], ["Second page."]]);
    const info = await inspectPdf(pdf);
    expect(info.pageCount).toBe(2);
    expect(info.hasTextLayer).toBe(true);
    const texts = await extractPagesText(pdf, [2]);
    expect(texts.get(2)).toBe("Second page.");
    const scanned = await inspectPdf(buildImageOnlyPdf());
    expect(scanned.hasTextLayer).toBe(false);
    await expect(inspectPdf(Buffer.from("not a pdf at all"))).rejects.toThrow();
  });
});

describe("Cache et limites", () => {
  it("l'empreinte de segment est stable face aux espaces", () => {
    expect(hashSegment("Hello   world ")).toBe(hashSegment("Hello world"));
    expect(hashSegment("Hello world")).not.toBe(hashSegment("Hello worlds"));
  });
  it("le limiteur applique une fenêtre glissante", () => {
    resetRateLimits();
    expect(checkRateLimit("k", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("k", 2, 60_000).allowed).toBe(true);
    const third = checkRateLimit("k", 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
  it("le prompt de résumé interdit l'invention de contenu", () => {
    const { system, user } = buildSummaryPrompt({ text: "Body", language: "fr", documentTitle: "T", pageRange: { start: 1, end: 2 } });
    expect(system).toMatch(/Never invent/);
    expect(system).toContain("French");
    expect(user).toContain("pages 1 to 2");
  });
});
