import { describe, expect, it, beforeAll, beforeEach, afterEach } from "vitest";
import { actAs, call, createPublishedDocument, provisionStaff, registerStudent } from "./helpers";
import { MockTranslationProvider } from "@/lib/providers/translation/mock";
import { setTranslationProviderForTests } from "@/lib/providers/translation";
import { MockAiProvider, setAiProviderForTests } from "@/lib/providers/ai";
import { resetRateLimits } from "@/lib/rate-limit";
import { sha256 } from "@/lib/providers/storage";

let admin: { token: string };
let student: { token: string };
let docId: string;
let scannedId: string;
let provider: MockTranslationProvider;
let ai: MockAiProvider;

beforeAll(async () => {
  admin = await provisionStaff("admin");
  student = await registerStudent();
  docId = await createPublishedDocument(admin.token);
  scannedId = await createPublishedDocument(admin.token, { title: "Document numérisé" }, [[]]);
});

beforeEach(() => {
  provider = new MockTranslationProvider();
  setTranslationProviderForTests(provider);
  ai = new MockAiProvider();
  setAiProviderForTests(ai);
  resetRateLimits();
});

afterEach(() => {
  setTranslationProviderForTests(undefined);
  setAiProviderForTests(undefined);
});

async function translate(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/translations/route");
  return call(POST, "POST", "/api/translations", { body });
}

describe("Lecteur — traduction à la demande", () => {
  it("un visiteur ne peut pas traduire", async () => {
    actAs(null);
    const res = await translate({ documentId: docId, pageNumber: 1, targetLanguage: "fr" });
    expect(res.status).toBe(401);
    expect(provider.calls).toHaveLength(0);
  });

  it("traduit uniquement la page demandée, après ouverture, et laisse le PDF intact", async () => {
    const { getDocumentById, getDocumentBuffer } = await import("@/lib/services/documents");
    const before = sha256(await getDocumentBuffer((await getDocumentById(docId))!));

    actAs(student.token);
    const res = await translate({ documentId: docId, pageNumber: 1, targetLanguage: "fr" });
    expect(res.status).toBe(200);
    expect(res.data.sourceLanguage).toBe("en");
    expect(res.data.targetLanguage).toBe("fr");
    expect(res.data.sameLanguage).toBe(false);
    expect(res.data.segments.length).toBeGreaterThanOrEqual(2);
    expect(res.data.segments[0].translated).toMatch(/^\[fr\] Introduction to Algorithms/);
    expect(res.data.segments.every((s: { fromCache: boolean }) => s.fromCache === false)).toBe(true);
    // Only page 1 text was sent to the provider.
    expect(provider.calls).toHaveLength(1);
    const sent = provider.calls[0].segments.join(" ");
    expect(sent).toContain("Introduction to Algorithms");
    expect(sent).not.toContain("insertion sort");

    const after = sha256(await getDocumentBuffer((await getDocumentById(docId))!));
    expect(after).toBe(before);
  });

  it("réutilise le cache et n'appelle plus le fournisseur pour la même page/langue", async () => {
    actAs(student.token);
    await translate({ documentId: docId, pageNumber: 2, targetLanguage: "fr" });
    expect(provider.calls).toHaveLength(1);
    const again = await translate({ documentId: docId, pageNumber: 2, targetLanguage: "fr" });
    expect(again.status).toBe(200);
    expect(again.data.cacheHits).toBe(again.data.segments.length);
    expect(again.data.providerSegments).toBe(0);
    expect(again.data.segments.every((s: { fromCache: boolean }) => s.fromCache)).toBe(true);
    expect(provider.calls).toHaveLength(1);
  });

  it("le cache est partagé entre étudiants (même texte source)", async () => {
    const other = await registerStudent("Autre étudiant");
    actAs(student.token);
    await translate({ documentId: docId, pageNumber: 3, targetLanguage: "es" });
    const callsBefore = provider.calls.length;
    actAs(other.token);
    const res = await translate({ documentId: docId, pageNumber: 3, targetLanguage: "es" });
    expect(res.data.providerSegments).toBe(0);
    expect(provider.calls.length).toBe(callsBefore);
  });

  it("une nouvelle langue cible déclenche une traduction appropriée (et l'arabe est en RTL)", async () => {
    actAs(student.token);
    await translate({ documentId: docId, pageNumber: 1, targetLanguage: "fr" });
    const calls = provider.calls.length;
    const ar = await translate({ documentId: docId, pageNumber: 1, targetLanguage: "ar" });
    expect(ar.status).toBe(200);
    expect(ar.data.direction).toBe("rtl");
    expect(ar.data.segments[0].translated).toMatch(/^\[ar\]/);
    expect(provider.calls.length).toBe(calls + 1);
    expect(provider.calls.at(-1)!.targetLanguage).toBe("ar");
  });

  it("revenir à la langue originale ne sollicite pas le fournisseur", async () => {
    actAs(student.token);
    const res = await translate({ documentId: docId, pageNumber: 1, targetLanguage: "en" });
    expect(res.status).toBe(200);
    expect(res.data.sameLanguage).toBe(true);
    expect(provider.calls).toHaveLength(0);
  });

  it("refuse une langue désactivée par l'administrateur", async () => {
    const { PATCH } = await import("@/app/api/admin/languages/[code]/route");
    const { GET: publicLangs } = await import("@/app/api/languages/route");
    actAs(admin.token);
    await call(PATCH, "PATCH", "/api/admin/languages/pt", { params: { code: "pt" }, body: { isActive: false } });
    actAs(null);
    const langs = await call(publicLangs, "GET", "/api/languages");
    expect(langs.data.items.some((l: { code: string }) => l.code === "pt")).toBe(false);
    actAs(student.token);
    const res = await translate({ documentId: docId, pageNumber: 1, targetLanguage: "pt" });
    expect(res.status).toBe(400);
    expect(provider.calls).toHaveLength(0);
    actAs(admin.token);
    await call(PATCH, "PATCH", "/api/admin/languages/pt", { params: { code: "pt" }, body: { isActive: true } });
  });

  it("un PDF sans texte extractible renvoie un message explicite, jamais un faux texte", async () => {
    actAs(student.token);
    const res = await translate({ documentId: scannedId, pageNumber: 1, targetLanguage: "fr" });
    expect(res.status).toBe(422);
    expect(res.data.error.code).toBe("no_text");
    expect(res.data.error.message).toMatch(/OCR/);
    expect(provider.calls).toHaveLength(0);
  });

  it("une erreur du fournisseur renvoie une erreur, pas un succès simulé", async () => {
    actAs(student.token);
    provider.failNext = true;
    const res = await translate({ documentId: docId, pageNumber: 2, targetLanguage: "ar" });
    expect(res.status).toBe(502);
    expect(res.data.error.code).toBe("provider_error");
    // Nothing was cached for that failed attempt.
    provider.failNext = false;
    const retry = await translate({ documentId: docId, pageNumber: 2, targetLanguage: "ar" });
    expect(retry.status).toBe(200);
    expect(retry.data.providerSegments).toBeGreaterThan(0);
  });

  it("sans fournisseur configuré, l'erreur de configuration est explicite", async () => {
    setTranslationProviderForTests(null);
    actAs(student.token);
    const res = await translate({ documentId: docId, pageNumber: 3, targetLanguage: "ar" });
    expect(res.status).toBe(503);
    expect(res.data.error.code).toBe("not_configured");
  });

  it("applique la limite d'utilisation", async () => {
    process.env.RATE_LIMIT_TRANSLATIONS_PER_HOUR = "1";
    const { resetEnvCache } = await import("@/lib/env");
    resetEnvCache();
    try {
      const fresh = await registerStudent("Quota");
      const freshDoc = await createPublishedDocument(admin.token, { title: "Quota doc" }, [["Quota page one text content."], ["Quota page two text content."]]);
      actAs(fresh.token);
      expect((await translate({ documentId: freshDoc, pageNumber: 1, targetLanguage: "fr" })).status).toBe(200);
      const limited = await translate({ documentId: freshDoc, pageNumber: 2, targetLanguage: "fr" });
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBeTruthy();
    } finally {
      process.env.RATE_LIMIT_TRANSLATIONS_PER_HOUR = "100";
      resetEnvCache();
    }
  });

  it("les requêtes simultanées identiques ne déclenchent qu'un appel fournisseur", async () => {
    const { translatePage } = await import("@/lib/services/translation");
    const { resolveSessionToken } = await import("@/lib/auth/session");
    const auth = (await resolveSessionToken(student.token))!;
    const fresh = await createPublishedDocument(admin.token, { title: "Concurrent" }, [["Concurrent page text to translate once only."]]);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => translatePage({ user: auth.user, documentId: fresh, pageNumber: 1, targetLanguage: "fr" })),
    );
    expect(results.every((r) => r.segments[0].translated?.startsWith("[fr]"))).toBe(true);
    expect(provider.calls).toHaveLength(1);
  });

  it("l'invalidation administrative force une nouvelle traduction", async () => {
    const { POST: invalidate } = await import("@/app/api/admin/translation-cache/invalidate/route");
    const { GET: list } = await import("@/app/api/admin/translation-cache/route");
    actAs(student.token);
    await translate({ documentId: docId, pageNumber: 1, targetLanguage: "fr" });
    await translate({ documentId: docId, pageNumber: 1, targetLanguage: "fr" });
    const callsBefore = provider.calls.length;
    actAs(admin.token);
    const listed = await call(list, "GET", `/api/admin/translation-cache?documentId=${docId}&targetLanguage=fr`);
    expect(listed.data.total).toBeGreaterThan(0);
    const inv = await call(invalidate, "POST", "/api/admin/translation-cache/invalidate", { body: { documentId: docId, targetLanguage: "fr" } });
    expect(inv.status).toBe(200);
    expect(inv.data.invalidated).toBeGreaterThan(0);
    actAs(student.token);
    const after = await translate({ documentId: docId, pageNumber: 1, targetLanguage: "fr" });
    expect(after.data.providerSegments).toBeGreaterThan(0);
    expect(provider.calls.length).toBe(callsBefore + 1);
    // students cannot invalidate
    const forbidden = await call(invalidate, "POST", "/api/admin/translation-cache/invalidate", { body: { documentId: docId } });
    expect(forbidden.status).toBe(403);
  });

  it("un signalement de traduction est enregistré et traitable", async () => {
    const { POST: report } = await import("@/app/api/translation-reports/route");
    const { GET: list } = await import("@/app/api/admin/reports/route");
    const { PATCH: update } = await import("@/app/api/admin/reports/[id]/route");
    actAs(student.token);
    const created = await call(report, "POST", "/api/translation-reports", {
      body: { documentId: docId, pageNumber: 1, segmentIndex: 0, targetLanguage: "fr", description: "Contresens dans la première phrase." },
    });
    expect(created.status).toBe(201);
    actAs(admin.token);
    const items = await call(list, "GET", "/api/admin/reports?status=new");
    expect(items.data.items.some((r: { report: { id: string } }) => r.report.id === created.data.report.id)).toBe(true);
    const id = created.data.report.id;
    const resolved = await call(update, "PATCH", `/api/admin/reports/${id}`, { params: { id }, body: { status: "resolved", response: "Cache invalidé." } });
    expect(resolved.status).toBe(200);
    expect(resolved.data.report.status).toBe("resolved");
  });
});

describe("Résumé de chapitre", () => {
  async function summarize(body: Record<string, unknown>) {
    const { POST } = await import("@/app/api/summaries/route");
    return call(POST, "POST", "/api/summaries", { body });
  }

  it("utilise le texte source des pages demandées et met en cache", async () => {
    actAs(student.token);
    const res = await summarize({ documentId: docId, startPage: 1, endPage: 2, language: "fr" });
    expect(res.status).toBe(200);
    expect(res.data.fromCache).toBe(false);
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0].text).toContain("Introduction to Algorithms");
    expect(ai.calls[0].text).toContain("insertion sort");
    expect(ai.calls[0].text).not.toContain("growth of functions");
    const again = await summarize({ documentId: docId, startPage: 1, endPage: 2, language: "fr" });
    expect(again.data.fromCache).toBe(true);
    expect(ai.calls).toHaveLength(1);
  });

  it("respecte la limite de taille d'entrée", async () => {
    process.env.SUMMARY_MAX_INPUT_CHARS = "120";
    const { resetEnvCache } = await import("@/lib/env");
    resetEnvCache();
    try {
      actAs(student.token);
      const res = await summarize({ documentId: docId, startPage: 1, endPage: 3, language: "en" });
      expect(res.status).toBe(200);
      expect(res.data.truncated).toBe(true);
      expect(ai.calls[0].text.length).toBeLessThanOrEqual(120);
    } finally {
      process.env.SUMMARY_MAX_INPUT_CHARS = "24000";
      resetEnvCache();
    }
  });

  it("gère l'erreur du fournisseur et l'absence de texte", async () => {
    actAs(student.token);
    ai.failNext = true;
    const err = await summarize({ documentId: docId, startPage: 3, endPage: 3, language: "es" });
    expect(err.status).toBe(502);
    const noText = await summarize({ documentId: scannedId, startPage: 1, endPage: 1, language: "fr" });
    expect(noText.status).toBe(422);
    expect(noText.data.error.code).toBe("no_text");
    setAiProviderForTests(null);
    const notConfigured = await summarize({ documentId: docId, startPage: 3, endPage: 3, language: "ar" });
    expect(notConfigured.status).toBe(503);
  });

  it("un visiteur ne peut pas demander de résumé", async () => {
    actAs(null);
    expect((await summarize({ documentId: docId, startPage: 1, endPage: 1, language: "fr" })).status).toBe(401);
  });
});
