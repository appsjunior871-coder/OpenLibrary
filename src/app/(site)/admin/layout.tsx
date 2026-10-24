import { requirePermission } from "@/lib/auth/guards";
import { roleHas } from "@/lib/authz/permissions";
import { getT } from "@/lib/i18n/server";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("admin:access", "/admin");
  const { t } = await getT();
  const items = [
    { href: "/admin", label: t.admin.dashboard, exact: true },
    { href: "/admin/documents", label: t.admin.documents },
    { href: "/admin/requests", label: t.admin.requests },
    { href: "/admin/reports", label: t.admin.reports },
    ...(roleHas(user.role, "languages:manage") ? [{ href: "/admin/languages", label: t.admin.languages }] : []),
    ...(roleHas(user.role, "users:manage") ? [{ href: "/admin/users", label: t.admin.users }] : []),
    ...(roleHas(user.role, "translation-cache:manage") ? [{ href: "/admin/cache", label: t.admin.cache }] : []),
    { href: "/admin/settings", label: t.admin.settings },
    ...(roleHas(user.role, "audit:read") ? [{ href: "/admin/audit", label: t.admin.audit }] : []),
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <AdminNav items={items} title={t.admin.title} role={user.role} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
