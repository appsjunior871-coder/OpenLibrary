import { redirect } from "next/navigation";
import { getAuth, type SessionUser } from "./session";
import { roleHas, type Permission } from "../authz/permissions";

/** Server-component guard: redirects visitors to the login page, preserving the destination. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const auth = await getAuth();
  if (!auth) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return auth.user;
}

/** Server-component guard for staff pages. Students get a 403 page. */
export async function requirePermission(permission: Permission, next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!roleHas(user.role, permission)) redirect("/forbidden");
  return user;
}
