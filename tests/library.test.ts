import { describe, expect, it, beforeAll } from "vitest";
import { actAs, BASE_META, call, createPublishedDocument, pdfFormData, provisionStaff, registerStudent, samplePdf } from "./helpers";

let admin: { token: string };
let contributor: { token: string; userId: string };
let student: { token: string };
let publishedId: string;

beforeAll(async () => {
  admin = await provisionStaff("admin");
  contributor = await provisionStaff("contributor");
  student = await registerStudent();
  publishedId = await createPublishedDocument(admin.token);
});

describe("Bibliothèque — gestion des documents", () => {
  it("un étudiant ne peut pas téléverser de document", async () => {
    const { POST } = await import("@/app/api/admin/documents/route");
    actAs(student.token);
    const res = await call(POST, "POST", "/api/admin/documents", { formData: pdfFormData(BASE_META, samplePdf(), "x.pdf") });
    expect(res.status).toBe(403);
  });

  it("rejette un fichier qui n'est pas un PDF", async () => {
    const { POST } = await import("@/app/api/admin/documents/route");
    actAs(admin.token);
    const res = await call(POST, "POST", "/api/admin/documents", {
      formData: pdfFormData(BASE_META, Buffer.from("<html>not a pdf</html>"), "evil.pdf"),
    });
    expect(res.status).toBe(400);
  });

  it("un document créé est un brouillon en attente de vérification, invisible publiquement", async () => {
    const { POST } = await import("@/app/api/admin/documents/route");
    const { GET: detail } = await import("@/app/api/documents/[id]/route");
    actAs(admin.token);
    const res = await call(POST, "POST", "/api/admin/documents", {
      formData: pdfFormData({ ...BASE_META, title: "Brouillon secret" }, samplePdf([["Brouillon secret page one content here."]]), "draft.pdf"),
    });
    expect(res.status).toBe(201);
    expect(res.data.document.status).toBe("draft");
    expect(res.data.document.distributionStatus).toBe("pending_review");
    expect(res.data.document).not.toHaveProperty("storageKey");
    const id = res.data.document.id;
    actAs(null);
    expect((await call(detail, "GET", `/api/documents/${id}`, { params: { id } })).status).toBe(404);
    actAs(student.token);
    expect((await call(detail, "GET", `/api/documents/${id}`, { params: { id } })).status).toBe(404);
    actAs(admin.token);
    expect((await call(detail, "GET", `/api/documents/${id}`, { params: { id } })).status).toBe(200);
  });

  it("refuse de publier un document dont la diffusion n'est pas approuvée ou dont la licence est insuffisante", async () => {
    const { POST: create } = await import("@/app/api/admin/documents/route");
    const { POST: status } = await import("@/app/api/admin/documents/[id]/status/route");
    const { POST: distribution } = await import("@/app/api/admin/documents/[id]/distribution/route");
    actAs(admin.token);
    const created = await call(create, "POST", "/api/admin/documents", {
      formData: pdfFormData({ ...BASE_META, title: "Licence inconnue", license: "Inconnue" }, samplePdf([["Unknown licence text page."]]), "lic.pdf"),
    });
    const id = created.data.document.id;
    // Not approved yet
    const notApproved = await call(status, "POST", `/api/admin/documents/${id}/status`, { params: { id }, body: { status: "published" } });
    expect(notApproved.status).toBe(409);
    // Cannot approve an unknown licence
    const approve = await call(distribution, "POST", `/api/admin/documents/${id}/distribution`, {
      params: { id },
      body: { distributionStatus: "approved" },
    });
    expect(approve.status).toBe(409);
  });

  it("un contributeur ne peut ni approuver la diffusion ni publier", async () => {
    const { POST: create } = await import("@/app/api/admin/documents/route");
    const { POST: status } = await import("@/app/api/admin/documents/[id]/status/route");
    const { POST: distribution } = await import("@/app/api/admin/documents/[id]/distribution/route");
    actAs(contributor.token);
    const created = await call(create, "POST", "/api/admin/documents", {
      formData: pdfFormData({ ...BASE_META, title: "Contribution" }, samplePdf([["Contributor document text page."]]), "contrib.pdf"),
    });
    expect(created.status).toBe(201);
    const id = created.data.document.id;
    expect(
      (await call(distribution, "POST", `/api/admin/documents/${id}/distribution`, { params: { id }, body: { distributionStatus: "approved" } })).status,
    ).toBe(403);
    expect((await call(status, "POST", `/api/admin/documents/${id}/status`, { params: { id }, body: { status: "published" } })).status).toBe(403);
  });

  it("détecte les doublons par empreinte du fichier", async () => {
    const { POST } = await import("@/app/api/admin/documents/route");
    actAs(admin.token);
    const res = await call(POST, "POST", "/api/admin/documents", {
      formData: pdfFormData({ ...BASE_META, title: "Copie" }, samplePdf(), "dup.pdf"),
    });
    expect(res.status).toBe(409);
  });
});

describe("Bibliothèque — catalogue public", () => {
  it("la recherche et les filtres fonctionnent sur les données réelles", async () => {
    const { GET } = await import("@/app/api/documents/route");
    actAs(null);
    const all = await call(GET, "GET", "/api/documents");
    expect(all.status).toBe(200);
    expect(all.data.items.some((d: { id: string }) => d.id === publishedId)).toBe(true);
    expect(all.data.items.every((d: { status: string }) => d.status === "published")).toBe(true);

    const byQuery = await call(GET, "GET", "/api/documents?q=algorithms");
    expect(byQuery.data.items.some((d: { id: string }) => d.id === publishedId)).toBe(true);
    const noMatch = await call(GET, "GET", "/api/documents?q=zzzzqqqq");
    expect(noMatch.data.total).toBe(0);

    const byDomain = await call(GET, "GET", "/api/documents?domain=Informatique&level=licence&language=en&author=Cormen");
    expect(byDomain.data.items.some((d: { id: string }) => d.id === publishedId)).toBe(true);
    const wrongDomain = await call(GET, "GET", "/api/documents?domain=Droit");
    expect(wrongDomain.data.items.some((d: { id: string }) => d.id === publishedId)).toBe(false);
    const byKeyword = await call(GET, "GET", "/api/documents?keyword=sorting");
    expect(byKeyword.data.items.some((d: { id: string }) => d.id === publishedId)).toBe(true);
  });

  it("n'expose jamais la clé de stockage et marque l'accès visiteur", async () => {
    const { GET } = await import("@/app/api/documents/[id]/route");
    actAs(null);
    const res = await call(GET, "GET", `/api/documents/${publishedId}`, { params: { id: publishedId } });
    expect(res.status).toBe(200);
    expect(res.data.document).not.toHaveProperty("storageKey");
    expect(res.data.document.canOpen).toBe(false);
    actAs(student.token);
    const asStudent = await call(GET, "GET", `/api/documents/${publishedId}`, { params: { id: publishedId } });
    expect(asStudent.data.document.canOpen).toBe(true);
  });

  it("les facettes reflètent le catalogue", async () => {
    const { GET } = await import("@/app/api/documents/facets/route");
    actAs(null);
    const res = await call(GET, "GET", "/api/documents/facets");
    expect(res.data.domains.some((d: { value: string }) => d.value === "Informatique")).toBe(true);
  });
});

describe("Bibliothèque — accès aux fichiers", () => {
  it("un visiteur ne peut ni ouvrir ni télécharger un document protégé", async () => {
    const { POST: open } = await import("@/app/api/documents/[id]/open/route");
    const { GET: file } = await import("@/app/api/documents/[id]/file/route");
    actAs(null);
    expect((await call(open, "POST", `/api/documents/${publishedId}/open`, { params: { id: publishedId } })).status).toBe(401);
    expect((await call(file, "GET", `/api/documents/${publishedId}/file`, { params: { id: publishedId } })).status).toBe(401);
  });

  it("un étudiant ouvre le document, obtient les langues actives et le flux PDF (avec Range)", async () => {
    const { POST: open } = await import("@/app/api/documents/[id]/open/route");
    const { GET: file } = await import("@/app/api/documents/[id]/file/route");
    actAs(student.token);
    const opened = await call(open, "POST", `/api/documents/${publishedId}/open`, { params: { id: publishedId } });
    expect(opened.status).toBe(200);
    expect(opened.data.fileUrl).toBe(`/api/documents/${publishedId}/file`);
    expect(opened.data.languages.map((l: { code: string }) => l.code)).toEqual(expect.arrayContaining(["fr", "en", "es", "ar", "pt"]));
    expect(opened.data.document.sourceLanguage).toBe("en");

    const full = await call(file, "GET", `/api/documents/${publishedId}/file`, { params: { id: publishedId } });
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("application/pdf");
    expect(String(full.data).startsWith("%PDF-")).toBe(true);

    const range = await call(file, "GET", `/api/documents/${publishedId}/file`, { params: { id: publishedId }, headers: { range: "bytes=0-9" } });
    expect(range.status).toBe(206);
    expect(range.headers.get("content-range")).toMatch(/^bytes 0-9\//);
  });

  it("le téléchargement est refusé quand il est désactivé, autorisé sinon", async () => {
    const { GET: file } = await import("@/app/api/documents/[id]/file/route");
    const noDl = await createPublishedDocument(admin.token, { title: "Lecture seule", allowDownload: "false" }, [["Read only document page text."]]);
    actAs(student.token);
    const denied = await call(file, "GET", `/api/documents/${noDl}/file?download=1`, { params: { id: noDl } });
    expect(denied.status).toBe(403);
    const inline = await call(file, "GET", `/api/documents/${noDl}/file`, { params: { id: noDl } });
    expect(inline.status).toBe(200);
    const ok = await call(file, "GET", `/api/documents/${publishedId}/file?download=1`, { params: { id: publishedId } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toContain("attachment");
  });

  it("l'historique de lecture et les favoris sont persistés", async () => {
    const { GET: history } = await import("@/app/api/me/history/route");
    const { PATCH: position } = await import("@/app/api/me/history/[documentId]/route");
    const { GET: favorites, POST: addFav } = await import("@/app/api/me/favorites/route");
    const { DELETE: removeFav } = await import("@/app/api/me/favorites/[documentId]/route");
    actAs(student.token);
    await call(position, "PATCH", `/api/me/history/${publishedId}`, { params: { documentId: publishedId }, body: { lastPage: 2 } });
    const h = await call(history, "GET", "/api/me/history");
    const entry = h.data.items.find((i: { documentId: string }) => i.documentId === publishedId);
    expect(entry.lastPage).toBe(2);

    expect((await call(addFav, "POST", "/api/me/favorites", { body: { documentId: publishedId } })).status).toBe(201);
    let favs = await call(favorites, "GET", "/api/me/favorites");
    expect(favs.data.items.some((f: { documentId: string }) => f.documentId === publishedId)).toBe(true);
    await call(removeFav, "DELETE", `/api/me/favorites/${publishedId}`, { params: { documentId: publishedId } });
    favs = await call(favorites, "GET", "/api/me/favorites");
    expect(favs.data.items.some((f: { documentId: string }) => f.documentId === publishedId)).toBe(false);
  });

  it("les demandes de documents sont enregistrées et traitées par le personnel", async () => {
    const { POST: create, GET: mine } = await import("@/app/api/document-requests/route");
    const { GET: all } = await import("@/app/api/admin/requests/route");
    const { PATCH: resolve } = await import("@/app/api/admin/requests/[id]/route");
    actAs(null);
    expect((await call(create, "POST", "/api/document-requests", { body: { title: "X", description: "Visitor request attempt" } })).status).toBe(401);
    actAs(student.token);
    const created = await call(create, "POST", "/api/document-requests", {
      body: { title: "Pattern Recognition and Machine Learning", author: "Bishop", domain: "Informatique", description: "Référence pour le cours de ML." },
    });
    expect(created.status).toBe(201);
    const id = created.data.request.id;
    actAs(contributor.token);
    const list = await call(all, "GET", "/api/admin/requests?status=pending");
    expect(list.data.items.some((r: { request: { id: string } }) => r.request.id === id)).toBe(true);
    const resolved = await call(resolve, "PATCH", `/api/admin/requests/${id}`, { params: { id }, body: { status: "accepted", response: "Ajouté au catalogue." } });
    expect(resolved.status).toBe(200);
    actAs(student.token);
    const own = await call(mine, "GET", "/api/document-requests");
    expect(own.data.items.find((r: { id: string }) => r.id === id).status).toBe("accepted");
  });
});
