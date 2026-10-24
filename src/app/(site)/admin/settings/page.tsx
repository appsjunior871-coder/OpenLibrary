import { requirePermission } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { getDbHandle } from "@/lib/db/client";
import { describeTranslationConfig } from "@/lib/providers/translation";
import { describeAiConfig } from "@/lib/providers/ai";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";

export default async function AdminSettingsPage() {
  await requirePermission("settings:read", "/admin/settings");
  const env = getEnv();
  const db = await getDbHandle();
  const translation = describeTranslationConfig();
  const ai = describeAiConfig();
  const ocrConfigured = env.OCR_PROVIDER !== "none" && Boolean(env.OCR_API_KEY);

  return (
    <div>
      <PageHeader title="Services externes" subtitle="Vue en lecture seule de la configuration (variables d'environnement). Les clés ne sont jamais affichées ni modifiables ici." />
      <Alert tone="info" className="mb-6">
        Pour modifier un fournisseur, éditez le fichier <code className="rounded bg-white px-1">.env.local</code> (ou les variables du déploiement) puis redémarrez l&apos;application. Voir le README, section « Configuration des fournisseurs externes ».
      </Alert>
      <div className="grid gap-4 md:grid-cols-2">
        <Service title="Traduction" status={translation.configured} rows={[["Fournisseur", translation.provider], ["Clé API", translation.hasApiKey ? "présente" : "absente"], ["URL", translation.apiUrl ?? "par défaut"], ["Max caractères / requête", String(translation.maxChars)], ["Délai (ms)", String(translation.timeoutMs)]]} hint={!translation.configured ? "Les étudiants verront une erreur de configuration explicite dans le lecteur." : undefined} />
        <Service title="Résumé (IA)" status={ai.configured} rows={[["Fournisseur", ai.provider], ["Clé API", ai.hasApiKey ? "présente" : "absente"], ["Modèle", ai.model ?? "par défaut"], ["URL", ai.apiUrl ?? "par défaut"], ["Max caractères en entrée", String(ai.maxInputChars)], ["Délai (ms)", String(ai.timeoutMs)]]} hint={!ai.configured ? "Le bouton « Résumer ce chapitre » renverra une erreur de configuration." : undefined} />
        <Service title="OCR (documents numérisés)" status={ocrConfigured} rows={[["Fournisseur", env.OCR_PROVIDER], ["Clé API", env.OCR_API_KEY ? "présente" : "absente"]]} hint={!ocrConfigured ? "Les PDF sans couche texte afficheront un message « OCR nécessaire »." : undefined} />
        <Service title="Base de données et stockage" status rows={[["Base", db.kind === "pglite" ? "PGlite (PostgreSQL embarqué)" : "PostgreSQL"], ["Stockage", env.STORAGE_PROVIDER], ["Dossier", env.STORAGE_LOCAL_DIR], ["Taille max. PDF", `${Math.round(env.MAX_UPLOAD_BYTES / 1024 / 1024)} Mo`]]} />
        <Service title="Limites d'utilisation" status rows={[["Traductions / h / utilisateur", String(env.RATE_LIMIT_TRANSLATIONS_PER_HOUR)], ["Résumés / h / utilisateur", String(env.RATE_LIMIT_SUMMARIES_PER_HOUR)], ["Connexions / 15 min / e-mail", String(env.RATE_LIMIT_LOGIN_PER_15MIN)]]} />
      </div>
    </div>
  );
}

function Service({ title, status, rows, hint }: { title: string; status: boolean; rows: [string, string][]; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <Badge tone={status ? "success" : "warning"}>{status ? "configuré" : "non configuré"}</Badge>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-slate-500">{k}</dt>
            <dd className="truncate font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      {hint && <p className="mt-3 text-xs text-amber-700">{hint}</p>}
    </Card>
  );
}
