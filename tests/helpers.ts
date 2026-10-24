import { NextRequest } from "next/server";
import { testRequestContext } from "./setup";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { buildSimplePdf } from "@/lib/pdf/test-pdf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteFn = (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>;

export async function call(
  handler: RouteFn,
  method: string,
  url: string,
  opts: { body?: unknown; params?: Record<string, string>; formData?: FormData; headers?: Record<string, string> } = {},
) {
  const init: RequestInit = { method, headers: { ...(opts.headers ?? {}) } };
  if (opts.formData) init.body = opts.formData;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  const req = new NextRequest(new URL(url, "http://localhost:3000"), init as never);
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, data: data as any, headers: res.headers };
}

/** Switch the simulated browser to a given session token (or to a visitor with `null`). */
export function actAs(token: string | null) {
  testRequestContext.cookies.clear();
  if (token) testRequestContext.cookies.set(SESSION_COOKIE, token);
}

export function currentSessionToken() {
  return testRequestContext.cookies.get(SESSION_COOKIE) ?? null;
}

let counter = 0;
export function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}${counter}-${Date.now()}@example.org`;
}

export const STRONG_PASSWORD = "Correct-horse-42";

/** Registers a student through the real route and returns the session token. */
export async function registerStudent(displayName = "Étudiant Test") {
  const { POST } = await import("@/app/api/auth/register/route");
  actAs(null);
  const email = uniqueEmail("student");
  const res = await call(POST, "POST", "/api/auth/register", {
    body: { displayName, email, password: STRONG_PASSWORD, passwordConfirmation: STRONG_PASSWORD, acceptTerms: true },
  });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.data)}`);
  const token = currentSessionToken()!;
  return { token, email, userId: res.data.user.id as string };
}

/** Provisions a staff account via the secure CLI service (never via HTTP) and logs in. */
export async function provisionStaff(role: "admin" | "contributor") {
  const { provisionStaffUser } = await import("@/lib/services/auth");
  const { POST: login } = await import("@/app/api/auth/login/route");
  const email = uniqueEmail(role);
  await provisionStaffUser({ displayName: `${role} test`, email, password: STRONG_PASSWORD, role });
  actAs(null);
  const res = await call(login, "POST", "/api/auth/login", { body: { email, password: STRONG_PASSWORD } });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.data)}`);
  return { token: currentSessionToken()!, email, userId: res.data.user.id as string };
}

export const SAMPLE_PAGES: string[][] = [
  [
    "Introduction to Algorithms is a textbook used in many computer science courses around the world.",
    "This first chapter explains what an algorithm is and why asymptotic analysis matters for engineers.",
  ],
  [
    "Chapter two introduces insertion sort and merge sort, and compares their running times carefully.",
    "Recurrences are solved with the master theorem in the following sections of the book.",
  ],
  ["Chapter three is about growth of functions and standard notations such as big O and Theta."],
];

export function samplePdf(pages: string[][] = SAMPLE_PAGES) {
  return buildSimplePdf(pages);
}

export function pdfFormData(meta: Record<string, string>, pdf: Buffer, filename = "sample.pdf") {
  const form = new FormData();
  for (const [k, v] of Object.entries(meta)) form.append(k, v);
  form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);
  return form;
}

export const BASE_META = {
  title: "Introduction to Algorithms",
  author: "Cormen, Leiserson, Rivest, Stein",
  description: "A comprehensive textbook on algorithms.",
  domain: "Informatique",
  level: "licence",
  keywords: "algorithms, sorting, complexity",
  sourceLanguage: "en",
  license: "CC BY",
  allowDownload: "true",
};

/** Full staff workflow: upload → approve distribution → publish. Returns the document id. */
export async function createPublishedDocument(adminToken: string, overrides: Partial<typeof BASE_META> = {}, pages?: string[][]) {
  const { POST: create } = await import("@/app/api/admin/documents/route");
  const { POST: distribution } = await import("@/app/api/admin/documents/[id]/distribution/route");
  const { POST: status } = await import("@/app/api/admin/documents/[id]/status/route");
  actAs(adminToken);
  const created = await call(create, "POST", "/api/admin/documents", {
    formData: pdfFormData({ ...BASE_META, ...overrides }, samplePdf(pages), `${Math.random()}.pdf`),
  });
  if (created.status !== 201) throw new Error(`create failed: ${JSON.stringify(created.data)}`);
  const id = created.data.document.id as string;
  const approved = await call(distribution, "POST", `/api/admin/documents/${id}/distribution`, {
    params: { id },
    body: { distributionStatus: "approved", note: "Licence vérifiée" },
  });
  if (approved.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approved.data)}`);
  const published = await call(status, "POST", `/api/admin/documents/${id}/status`, { params: { id }, body: { status: "published" } });
  if (published.status !== 200) throw new Error(`publish failed: ${JSON.stringify(published.data)}`);
  return id;
}
