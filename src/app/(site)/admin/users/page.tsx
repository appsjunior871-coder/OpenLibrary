import { requirePermission } from "@/lib/auth/guards";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@/lib/db/schema";
import { listUsers } from "@/lib/services/admin";
import { Alert, Badge, Input, PageHeader, Select, buttonClasses, formatDateTime } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const me = await requirePermission("users:manage", "/admin/users");
  const sp = await searchParams;
  const role = (USER_ROLES as readonly string[]).includes(sp.role ?? "") ? (sp.role as UserRole) : undefined;
  const status = (USER_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as UserStatus) : undefined;
  const result = await listUsers({ q: sp.q, role, status, page: Number(sp.page ?? 1) || 1 });

  return (
    <div>
      <PageHeader title="Utilisateurs" subtitle="Suspension / réactivation et attribution des rôles. Toute opération est journalisée." />
      <Alert tone="info" className="mb-4">
        Les comptes administrateur et contributeur se créent avec <code className="rounded bg-white px-1">npm run admin:create</code> ou en promouvant un compte existant ci-dessous. Aucune inscription publique ne peut obtenir ces rôles.
      </Alert>
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="E-mail ou nom" className="max-w-xs" />
        <Select name="role" defaultValue={role ?? ""} className="max-w-[10rem]">
          <option value="">Tous rôles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""} className="max-w-[10rem]">
          <option value="">Tous statuts</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Filtrer
        </button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Dernière connexion</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{u.displayName}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.role === "admin" ? "accent" : u.role === "contributor" ? "brand" : "neutral"}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.status === "active" ? "success" : u.status === "suspended" ? "warning" : "danger"}>{u.status}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(u.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  {u.id !== me.id && u.status !== "deleted" && (
                    <div className="flex flex-wrap gap-1">
                      {u.status === "active" ? (
                        <ActionButton url={`/api/admin/users/${u.id}`} method="PATCH" body={{ status: "suspended" }} label="Suspendre" variant="danger" confirm={`Suspendre ${u.email} ? Ses sessions seront révoquées.`} />
                      ) : (
                        <ActionButton url={`/api/admin/users/${u.id}`} method="PATCH" body={{ status: "active" }} label="Réactiver" variant="primary" />
                      )}
                      {USER_ROLES.filter((r) => r !== u.role).map((r) => (
                        <ActionButton key={r} url={`/api/admin/users/${u.id}`} method="PATCH" body={{ role: r }} label={`→ ${r}`} variant="ghost" confirm={`Attribuer le rôle ${r} à ${u.email} ? L'utilisateur devra se reconnecter.`} />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">{result.total} compte(s)</p>
    </div>
  );
}
