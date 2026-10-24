import { z } from "zod";
import { json, parseJson, protectedRoute } from "@/lib/http/api";
import { createLanguage, listLanguages } from "@/lib/services/languages";

export const GET = protectedRoute("admin:access", async () => json({ items: await listLanguages() }));

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2,3}(-[a-z]{2,4})?$/, "Code de langue invalide (ex. fr, pt-br)."),
  name: z.string().trim().min(2).max(60),
  nativeName: z.string().trim().min(1).max(60),
  direction: z.enum(["ltr", "rtl"]).default("ltr"),
  isActive: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(100),
});

export const POST = protectedRoute("languages:manage", async ({ req, auth }) => {
  const body = await parseJson(req, createSchema);
  const created = await createLanguage(auth.user.id, body);
  return json({ language: created }, { status: 201 });
});
