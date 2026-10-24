import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/db/schema";
import { listDocumentsForStaff } from "@/lib/services/documents";
import { Badge, ButtonLink, EmptyState, Input, PageHeader, Select, buttonClasses, formatDate } from "@/components/ui";

const statusTone: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
  removed: "danger",
};
const distTone: Record<string, "success" | "warning" | "danger"> = { approved: "success", pending_review: "warning", refused: "danger" };

export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const user = await requirePermission("admin:access", "/admin/documents");
  const sp = await searchParams;
  const status = (DOCUMENT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as DocumentStatus) : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const result = await listDocumentsForStaff(user, { status, q: sp.q, page, pageSize: 25 });

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Téléversement, métadonnées, licence, vérification de diffusion et publication."
        actions={
          <ButtonLink href="/admin/documents/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter un document
          </ButtonLink>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Titre ou auteur" className="max-w-xs" />
        <Select name="status" defaultValue={status ?? ""} className="max-w-[12rem]">
          <option value="">Tous les statuts</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Filtrer
        </button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="Aucun document" body="Commencez par téléverser un PDF." action={<ButtonLink href="/admin/documents/new">Ajouter un document</ButtonLink>} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Langue</th>
                <th className="px-4 py-3">Licence</th>
                <th className="px-4 py-3">Diffusion</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Modifié</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/documents/${d.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {d.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {d.author} · {d.pageCount} p. {d.creatorName ? `· ${d.creatorName}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 uppercase">{d.sourceLanguage}</td>
                  <td className="px-4 py-3">{d.license}</td>
                  <td className="px-4 py-3">
                    <Badge tone={distTone[d.distributionStatus]}>{d.distributionStatus}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[d.status]}>{d.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {result.total} document(s) · page {result.page}
      </p>
    </div>
  );
}
