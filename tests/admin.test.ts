import { describe, expect, it, beforeAll } from "vitest";
import { actAs, call, createPublishedDocument, provisionStaff, registerStudent } from "./helpers";
import { MockTranslationProvider } from "@/lib/providers/translation/mock";
import { setTranslationProviderForTests } from "@/lib/providers/translation";

let admin: { token: string; userId: string };
let student: { token: string; userId: string };
let docId: string;

beforeAll(async () => {
  admin = await provisionStaff("admin");
  student = await registerStudent();
  docId = await createPublishedDocument(admin.token);
});

describe("Administration", () => {
  it("les statistiques sont calculées à partir des données réelles", async () => {
    const { GET } = await import("@/app/api/admin/dashboard/route");
    const { POST: open } = await import("@/app/api/documents/[id]/open/route");
    const { POST: translate } = await import("@/app/api/translations/route");
    setTranslationProviderForTests(new MockTranslationProvider());

    actAs(admin.token);
    const before = await call(GET, "GET", "/api/admin/dashboard");
    expect(before.status).toBe(200);
    expect(before.data.documents.published).toBeGreaterThanOrEqual(1);
    const readsBefore = before.data.activity30d.reads;
    const translationsBefore = before.data.activity30d.translations.requested;

    actAs(student.token);
    await call(open, "POST", `/api/documents/${docId}/open`, { params: { id: docId } });
    await call(translate, "POST", "/api/translations", { body: { documentId: docId, pageNumber: 1, targetLanguage: "fr" } });
    await call(translate, "POST", "/api/translations", { body: { documentId: docId, pageNumber: 1, targetLanguage: "fr" } });

    actAs(admin.token);
    const after = await call(GET, "GET", "/api/admin/dashboard");
    expect(after.data.activity30d.reads).toBe(readsBefore + 1);
    expect(after.data.activity30d.translations.requested).toBe(translationsBefore + 2);
    expect(after.data.activity30d.translations.cacheHits).toBeGreaterThanOrEqual(1);
    expect(after.data.activity30d.topTargetLanguages.some((l: { language: string }) => l.language === "fr")).toBe(true);
    expect(after.data.period.last30DaysSince).toBeTruthy();
    setTranslationProviderForTests(undefined);
  });

  it("la gestion des langues fonctionne et est journalisée", async () => {
    const { GET: list, POST: create } = await import("@/app/api/admin/languages/route");
    const { PATCH } = await import("@/app/api/admin/languages/[code]/route");
    const { GET: audit } = await import("@/app/api/admin/audit/route");
    actAs(admin.token);
    const created = await call(create, "POST", "/api/admin/languages", {
      body: { code: "de", name: "Allemand", nativeName: "Deutsch", direction: "ltr", isActive: false },
    });
    expect(created.status).toBe(201);
    const toggled = await call(PATCH, "PATCH", "/api/admin/languages/de", { params: { code: "de" }, body: { isActive: true, supportsSummary: false } });
    expect(toggled.status).toBe(200);
    expect(toggled.data.language.isActive).toBe(true);
    const all = await call(list, "GET", "/api/admin/languages");
    expect(all.data.items.some((l: { code: string }) => l.code === "de")).toBe(true);
    const logs = await call(audit, "GET", "/api/admin/audit?action=language.updated");
    expect(logs.data.rows.length).toBeGreaterThan(0);
    expect(logs.data.rows[0].actorId).toBe(admin.userId);
  });

  it("l'administrateur gère les comptes (suspension révoque la session) mais pas le sien", async () => {
    const { GET: list, } = await import("@/app/api/admin/users/route");
    const { PATCH } = await import("@/app/api/admin/users/[id]/route");
    const { GET: me } = await import("@/app/api/me/route");
    const victim = await registerStudent("À suspendre");
    actAs(admin.token);
    const users = await call(list, "GET", `/api/admin/users?q=suspendre`);
    expect(users.data.rows.some((u: { id: string }) => u.id === victim.userId)).toBe(true);
    const suspended = await call(PATCH, "PATCH", `/api/admin/users/${victim.userId}`, { params: { id: victim.userId }, body: { status: "suspended" } });
    expect(suspended.status).toBe(200);
    actAs(victim.token);
    expect((await call(me, "GET", "/api/me")).data.user).toBeNull();
    actAs(admin.token);
    const self = await call(PATCH, "PATCH", `/api/admin/users/${admin.userId}`, { params: { id: admin.userId }, body: { status: "suspended" } });
    expect(self.status).toBe(403);
    await call(PATCH, "PATCH", `/api/admin/users/${victim.userId}`, { params: { id: victim.userId }, body: { status: "active" } });
  });

  it("un changement de rôle est réservé à l'administrateur et force une reconnexion", async () => {
    const { PATCH } = await import("@/app/api/admin/users/[id]/route");
    const { GET: me } = await import("@/app/api/me/route");
    const target = await registerStudent("Futur contributeur");
    actAs(student.token);
    expect((await call(PATCH, "PATCH", `/api/admin/users/${target.userId}`, { params: { id: target.userId }, body: { role: "admin" } })).status).toBe(403);
    actAs(admin.token);
    expect((await call(PATCH, "PATCH", `/api/admin/users/${target.userId}`, { params: { id: target.userId }, body: { role: "contributor" } })).status).toBe(200);
    actAs(target.token);
    expect((await call(me, "GET", "/api/me")).data.user).toBeNull();
  });

  it("le retrait administratif rend un document inaccessible", async () => {
    const { POST: status } = await import("@/app/api/admin/documents/[id]/status/route");
    const { GET: detail } = await import("@/app/api/documents/[id]/route");
    const { GET: file } = await import("@/app/api/documents/[id]/file/route");
    const id = await createPublishedDocument(admin.token, { title: "À retirer" }, [["Document to be removed text page."]]);
    actAs(admin.token);
    expect((await call(status, "POST", `/api/admin/documents/${id}/status`, { params: { id }, body: { status: "removed" } })).status).toBe(200);
    actAs(student.token);
    expect((await call(detail, "GET", `/api/documents/${id}`, { params: { id } })).status).toBe(404);
    expect((await call(file, "GET", `/api/documents/${id}/file`, { params: { id } })).status).toBe(403);
  });

  it("la page des services externes ne divulgue aucun secret", async () => {
    const { GET } = await import("@/app/api/admin/settings/route");
    actAs(admin.token);
    const res = await call(GET, "GET", "/api/admin/settings");
    expect(res.status).toBe(200);
    const serialised = JSON.stringify(res.data);
    expect(serialised).not.toContain(process.env.AUTH_SECRET!);
    expect(res.data.translation).not.toHaveProperty("apiKey");
    expect(res.data.ai).not.toHaveProperty("apiKey");
  });

  it("les erreurs internes ne divulguent pas de détails", async () => {
    const { errorResponse } = await import("@/lib/http/api");
    const res = errorResponse(new Error("secret database password is hunter2"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});
