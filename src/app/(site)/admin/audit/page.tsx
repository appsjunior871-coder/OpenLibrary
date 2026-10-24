import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { listAuditLogs } from "@/lib/services/audit";
import { EmptyState, Input, PageHeader, buttonClasses, formatDateTime } from "@/components/ui";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requirePermission("audit:read", "/admin/audit");
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const result = await listAuditLogs({ action: sp.action || undefined, page, pageSize: 50 });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <div>
      <PageHeader title="Journal d'audit" subtitle="Opérations sensibles : connexions, provisionnement, publication, modération, invalidation de cache, gestion des comptes." />
      <form method="get" className="mb-4 flex gap-2">
        <Input name="action" defaultValue={sp.action ?? ""} placeholder="Filtrer par action (ex. document.status.published)" className="max-w-md" />
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Filtrer
        </button>
      </form>
      {result.rows.length === 0 ? (
        <EmptyState title="Aucune entrée" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Acteur</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Ressource</th>
                <th className="px-4 py-3">Métadonnées</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-2">{r.actorName ? `${r.actorName}` : <span className="text-slate-400">système</span>}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.resourceType} <span className="font-mono text-slate-400">{r.resourceId?.slice(0, 8)}</span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 font-mono text-[11px] text-slate-500" title={JSON.stringify(r.metadata)}>
                    {JSON.stringify(r.metadata)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{result.total} entrée(s)</span>
        <span className="flex gap-2">
          {page > 1 && (
            <Link href={`/admin/audit?page=${page - 1}${sp.action ? `&action=${sp.action}` : ""}`} className="hover:underline">
              ← Précédent
            </Link>
          )}
          <span>
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/admin/audit?page=${page + 1}${sp.action ? `&action=${sp.action}` : ""}`} className="hover:underline">
              Suivant →
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}
