import { requirePermission } from "@/lib/auth/guards";
import { listLanguages } from "@/lib/services/languages";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import { NewLanguageForm } from "@/components/admin/LanguageForm";

export default async function AdminLanguagesPage() {
  await requirePermission("languages:manage", "/admin/languages");
  const languages = await listLanguages();
  return (
    <div>
      <PageHeader title="Langues de lecture" subtitle="Les langues désactivées ne sont plus proposées dans le menu « Lire dans une autre langue » du lecteur. Les langues d'interface (FR/EN) sont indépendantes." />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Langue</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Traduction</th>
              <th className="px-4 py-3">Résumé</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {languages.map((l) => (
              <tr key={l.code}>
                <td className="px-4 py-3 font-mono">{l.code}</td>
                <td className="px-4 py-3">
                  {l.name} <span className="text-slate-500" dir={l.direction}>({l.nativeName})</span>
                </td>
                <td className="px-4 py-3 uppercase">{l.direction}</td>
                <td className="px-4 py-3">
                  <Badge tone={l.isActive ? "success" : "neutral"}>{l.isActive ? "oui" : "non"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={l.supportsTranslation ? "success" : "neutral"}>{l.supportsTranslation ? "oui" : "non"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={l.supportsSummary ? "success" : "neutral"}>{l.supportsSummary ? "oui" : "non"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <ActionButton url={`/api/admin/languages/${l.code}`} method="PATCH" body={{ isActive: !l.isActive }} label={l.isActive ? "Désactiver" : "Activer"} variant={l.isActive ? "secondary" : "primary"} />
                    <ActionButton url={`/api/admin/languages/${l.code}`} method="PATCH" body={{ supportsTranslation: !l.supportsTranslation }} label={l.supportsTranslation ? "− traduction" : "+ traduction"} variant="ghost" />
                    <ActionButton url={`/api/admin/languages/${l.code}`} method="PATCH" body={{ supportsSummary: !l.supportsSummary }} label={l.supportsSummary ? "− résumé" : "+ résumé"} variant="ghost" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card className="mt-6 p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Ajouter une langue</h2>
        <NewLanguageForm />
      </Card>
    </div>
  );
}
