import { requirePermission } from "@/lib/auth/guards";
import { listCacheEntries } from "@/lib/services/translation";
import { Badge, Card, EmptyState, Input, PageHeader, buttonClasses, formatDateTime } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";

export default async function AdminCachePage({ searchParams }: { searchParams: Promise<{ documentId?: string; targetLanguage?: string; page?: string }> }) {
  await requirePermission("translation-cache:manage", "/admin/cache");
  const sp = await searchParams;
  const uuid = /^[0-9a-f-]{36}$/i;
  const result = await listCacheEntries({
    documentId: sp.documentId && uuid.test(sp.documentId) ? sp.documentId : undefined,
    targetLanguage: sp.targetLanguage || undefined,
    page: Number(sp.page ?? 1) || 1,
    pageSize: 50,
  });
  return (
    <div>
      <PageHeader title="Cache de traduction" subtitle="Chaque entrée correspond à un segment (paragraphe) traduit. L'invalidation force une nouvelle traduction à la prochaine demande." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Entrées actives (filtre courant)</p>
          <p className="text-2xl font-bold">{result.stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Caractères en cache</p>
          <p className="text-2xl font-bold">{result.stats.chars.toLocaleString("fr-FR")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Réutilisations (hits)</p>
          <p className="text-2xl font-bold">{result.stats.hits.toLocaleString("fr-FR")}</p>
        </Card>
      </div>
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Input name="documentId" defaultValue={sp.documentId ?? ""} placeholder="ID du document" className="max-w-sm font-mono text-xs" />
        <Input name="targetLanguage" defaultValue={sp.targetLanguage ?? ""} placeholder="Langue cible (fr)" className="max-w-[10rem]" />
        <button type="submit" className={buttonClasses("secondary", "md")}>
          Filtrer
        </button>
        {(sp.documentId || sp.targetLanguage) && (
          <ActionButton
            url="/api/admin/translation-cache/invalidate"
            body={{ documentId: sp.documentId || undefined, targetLanguage: sp.targetLanguage || undefined }}
            label="Invalider toutes les entrées filtrées"
            variant="danger"
            size="md"
            confirm="Invalider toutes les entrées correspondant au filtre ?"
          />
        )}
      </form>
      {result.rows.length === 0 ? (
        <EmptyState title="Aucune entrée en cache" body="Les traductions apparaîtront ici dès qu'un étudiant aura utilisé le lecteur." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Page / seg.</th>
                <th className="px-4 py-3">Langues</th>
                <th className="px-4 py-3">Moteur</th>
                <th className="px-4 py-3">Aperçu</th>
                <th className="px-4 py-3">Hits</th>
                <th className="px-4 py-3">État</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((r) => (
                <tr key={r.id} className={r.invalidatedAt ? "opacity-50" : ""}>
                  <td className="max-w-[12rem] truncate px-4 py-2" title={r.documentTitle ?? r.documentId ?? ""}>
                    {r.documentTitle ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    {r.pageNumber ?? "—"} / {r.segmentIndex + 1}
                  </td>
                  <td className="px-4 py-2 uppercase">
                    {r.sourceLanguage} → {r.targetLanguage}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.provider} / {r.engineVersion}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-slate-600" title={r.preview}>
                    {r.preview}
                  </td>
                  <td className="px-4 py-2">{r.hitCount}</td>
                  <td className="px-4 py-2">
                    {r.invalidatedAt ? <Badge tone="danger">invalidé</Badge> : <Badge tone="success">actif</Badge>}
                    <p className="text-[10px] text-slate-400">{formatDateTime(r.createdAt)}</p>
                  </td>
                  <td className="px-4 py-2">{!r.invalidatedAt && <ActionButton url="/api/admin/translation-cache/invalidate" body={{ ids: [r.id] }} label="Invalider" variant="ghost" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {result.total} entrée(s) · page {result.page}
      </p>
    </div>
  );
}
