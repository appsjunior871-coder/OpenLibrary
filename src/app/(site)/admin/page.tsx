import Link from "next/link";
import { getDashboardStats } from "@/lib/services/admin";
import { getT } from "@/lib/i18n/server";
import { listLanguages } from "@/lib/services/languages";
import { Card, PageHeader } from "@/components/ui";

export default async function AdminDashboardPage() {
  const [{ t, locale }, stats, languages] = await Promise.all([getT(), getDashboardStats(), listLanguages()]);
  const fr = locale === "fr";
  const since = new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", { dateStyle: "medium" }).format(new Date(stats.period.last30DaysSince));
  const langName = (code: string | null) => languages.find((l) => l.code === code)?.name ?? code ?? "—";
  const tr = stats.activity30d.translations;

  return (
    <div>
      <PageHeader title={t.admin.dashboard} subtitle={fr ? `Indicateurs calculés en temps réel. Période glissante : depuis le ${since}.` : `Live indicators. Rolling window since ${since}.`} />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{fr ? "Bibliothèque (total)" : "Library (all time)"}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={fr ? "Documents publiés" : "Published documents"} value={stats.documents.published} href="/admin/documents?status=published" />
        <Stat label={fr ? "En attente de vérification" : "Pending review"} value={stats.documents.pendingReview} tone="warning" href="/admin/documents" />
        <Stat label={fr ? "Brouillons" : "Drafts"} value={stats.documents.drafts} href="/admin/documents?status=draft" />
        <Stat label={fr ? "Archivés" : "Archived"} value={stats.documents.archived} href="/admin/documents?status=archived" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">{fr ? "Comptes (total)" : "Accounts (all time)"}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={fr ? "Comptes actifs" : "Active accounts"} value={stats.users.active} href="/admin/users" />
        <Stat label={fr ? "Nouveaux (30 j)" : "New (30 d)"} value={stats.users.newLast30d} />
        <Stat label={fr ? "Suspendus" : "Suspended"} value={stats.users.suspended} tone="warning" />
        <Stat label={fr ? "Personnel" : "Staff"} value={stats.users.staff} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">{fr ? "Activité (30 derniers jours)" : "Activity (last 30 days)"}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={fr ? "Lectures (ouvertures)" : "Reads (opens)"} value={stats.activity30d.reads} />
        <Stat label={fr ? "Téléchargements autorisés" : "Authorised downloads"} value={stats.activity30d.downloads} />
        <Stat label={fr ? "Traductions demandées" : "Translations requested"} value={tr.requested} />
        <Stat label={fr ? "Servies depuis le cache" : "Served from cache"} value={tr.cacheHits} tone="success" />
        <Stat label={fr ? "Appels fournisseur" : "Provider calls"} value={tr.providerCalls} />
        <Stat label={fr ? "Erreurs fournisseur" : "Provider errors"} value={tr.errors} tone={tr.errors > 0 ? "danger" : "neutral"} />
        <Stat label={fr ? "Quota atteint / sans texte" : "Rate limited / no text"} value={`${tr.rateLimited} / ${tr.noText}`} />
        <Stat label={fr ? "Caractères traduits" : "Characters translated"} value={tr.chars.toLocaleString(fr ? "fr-FR" : "en-GB")} />
        <Stat label={fr ? "Résumés demandés" : "Summaries requested"} value={stats.activity30d.summaries.requested} />
        <Stat label={fr ? "Résumés depuis le cache" : "Summaries from cache"} value={stats.activity30d.summaries.cacheHits} tone="success" />
        <Stat label={fr ? "Erreurs de résumé" : "Summary errors"} value={stats.activity30d.summaries.errors} tone={stats.activity30d.summaries.errors > 0 ? "danger" : "neutral"} />
        <Stat label={fr ? "Non configuré (tentatives)" : "Not configured (attempts)"} value={tr.notConfigured} tone={tr.notConfigured > 0 ? "warning" : "neutral"} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900">{fr ? "Langues cibles les plus utilisées (30 j)" : "Top target languages (30 d)"}</h3>
          {stats.activity30d.topTargetLanguages.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{fr ? "Aucune traduction sur la période." : "No translation in the period."}</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {stats.activity30d.topTargetLanguages.map((l) => {
                const max = stats.activity30d.topTargetLanguages[0].count || 1;
                return (
                  <li key={l.language ?? "?"} className="text-sm">
                    <div className="flex justify-between">
                      <span>{langName(l.language)}</span>
                      <span className="text-slate-500">{l.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-slate-100">
                      <div className="h-full rounded bg-brand-500" style={{ width: `${(l.count / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900">{fr ? "Modération" : "Moderation"}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <Link href="/admin/requests?status=pending" className="text-brand-700 hover:underline">
                {fr ? "Demandes de documents en attente" : "Pending document requests"}
              </Link>
              <span className="font-semibold">{stats.moderation.pendingRequests}</span>
            </li>
            <li className="flex justify-between">
              <Link href="/admin/reports?status=new" className="text-brand-700 hover:underline">
                {fr ? "Signalements non résolus" : "Open translation reports"}
              </Link>
              <span className="font-semibold">{stats.moderation.openReports}</span>
            </li>
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900">{fr ? "Cache de traduction (actif)" : "Translation cache (active)"}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>{fr ? "Segments" : "Segments"}</span>
              <span className="font-semibold">{stats.cache.entries}</span>
            </li>
            <li className="flex justify-between">
              <span>{fr ? "Caractères" : "Characters"}</span>
              <span className="font-semibold">{stats.cache.chars.toLocaleString(fr ? "fr-FR" : "en-GB")}</span>
            </li>
          </ul>
          <Link href="/admin/cache" className="mt-3 inline-block text-sm text-brand-700 hover:underline">
            {t.admin.cache} →
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "neutral", href }: { label: string; value: number | string; tone?: "neutral" | "success" | "warning" | "danger"; href?: string }) {
  const tones = { neutral: "text-slate-900", success: "text-emerald-700", warning: "text-amber-700", danger: "text-red-700" };
  const inner = (
    <Card className="h-full p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-lg hover:ring-2 hover:ring-brand-200">
      {inner}
    </Link>
  ) : (
    inner
  );
}
