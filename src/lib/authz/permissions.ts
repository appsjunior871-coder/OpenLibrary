import type { UserRole } from "../db/schema";

/**
 * Single source of truth for authorisation.
 * Three public actors: visitor (no session), student, staff (contributor | admin).
 * Contributors are a restricted staff role; admins hold every permission.
 */
export const PERMISSIONS = [
  // Student features
  "documents:read",
  "documents:download",
  "translations:use",
  "summaries:use",
  "favorites:manage",
  "history:manage",
  "document-requests:create",
  "translation-reports:create",
  "profile:manage",
  // Staff features
  "admin:access",
  "admin:dashboard",
  "documents:create",
  "documents:edit-own",
  "documents:edit-any",
  "documents:approve-distribution",
  "documents:publish",
  "documents:remove",
  "document-requests:review",
  "translation-reports:review",
  "languages:manage",
  "translation-cache:manage",
  "users:manage",
  "audit:read",
  "settings:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STUDENT: Permission[] = [
  "documents:read",
  "documents:download",
  "translations:use",
  "summaries:use",
  "favorites:manage",
  "history:manage",
  "document-requests:create",
  "translation-reports:create",
  "profile:manage",
];

const CONTRIBUTOR: Permission[] = [
  ...STUDENT,
  "admin:access",
  "admin:dashboard",
  "documents:create",
  "documents:edit-own",
  "document-requests:review",
  "translation-reports:review",
  "settings:read",
];

const ADMIN: Permission[] = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  student: new Set(STUDENT),
  contributor: new Set(CONTRIBUTOR),
  admin: new Set(ADMIN),
};

export function roleHas(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function isStaff(role: UserRole): boolean {
  return role === "admin" || role === "contributor";
}

/** Can `role` (user `userId`) edit a document created by `createdBy`? */
export function canEditDocument(role: UserRole, userId: string, createdBy: string | null): boolean {
  if (roleHas(role, "documents:edit-any")) return true;
  return roleHas(role, "documents:edit-own") && createdBy === userId;
}
