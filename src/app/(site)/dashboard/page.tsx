import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Heart, History, Languages, Inbox, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n/server";
import { listFavorites, listHistory, listOwnRequests } from "@/lib/services/activity";
import { listRecentTranslations } from "@/lib/services/translation";
import { listLanguages } from "@/lib/services/languages";
import { Badge, ButtonLink, Card, formatDateTime, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon espace" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const [{ t, locale }, history, favorites, translations, requests, languages] = await Promise.all([
    getT(),
    listHistory(user.id, 20),
    listFavorites(user.id),
    listRecentTranslations(user.id, 10),
    listOwnRequests(user.id),
    listLanguages(),
  ]);
  const langName = (code: string | null | undefined) => languages.find((l) => l.code === code)?.name ?? code ?? "—";
  const dateLocale = locale === "fr" ? "fr-FR" : "en-GB";
  const last = history[0];
  const requestStatus: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
    pending: { label: t.requests.statusPending, tone: "warning" },
    accepted: { label: t.requests.statusAccepted, tone: "success" },
    refused: { label: t.requests.statusRefused, tone: "danger" },
  };

  return (
    <div>
      <PageHeader
        title={`${t.dashboard.welcome}, ${user.displayName}`}
        subtitle={t.dashboard.title}
        actions={
          <>
            <ButtonLink href="/dashboard/requests" variant="secondary">
              <Inbox className="h-4 w-4" aria-hidden="true" />
              {t.dashboard.newRequest}
            </ButtonLink>
            <ButtonLink href="/dashboard/settings" variant="ghost">
              <Settings className="h-4 w-4" aria-hidden="true" />
              {t.nav.settings}
            </ButtonLink>
          </>
        }
      />

      {last && (
        <Card className="mb-8 flex flex-col gap-4 bg-brand-50/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t.dashboard.continueReading}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{last.title}</p>
            <p className="text-sm text-slate-600">
              {last.author} · {t.dashboard.lastPage} {last.lastPage}/{last.pageCount}
              {last.lastTargetLanguage ? ` · ${t.dashboard.readIn} ${langName(last.lastTargetLanguage)}` : ""}
            </p>
          </div>
          <ButtonLink href={`/read/${last.documentId}?page=${last.lastPage}${last.lastTargetLanguage ? `&lang=${last.lastTargetLanguage}` : ""}`}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {t.dashboard.continueReading}
          </ButtonLink>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={History} title={t.dashboard.history} empty={history.length === 0 ? t.dashboard.emptyRecent : null}>
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.documentId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/documents/${h.documentId}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">
                    {h.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {t.common.page} {h.lastPage}/{h.pageCount} · {formatDateTime(h.lastAccessedAt, dateLocale)}
                  </p>
                </div>
                <Link href={`/read/${h.documentId}?page=${h.lastPage}`} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
                  {t.common.open}
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Heart} title={t.dashboard.favorites} empty={favorites.length === 0 ? t.dashboard.emptyFavorites : null}>
          <ul className="divide-y divide-slate-100">
            {favorites.map((f) => (
              <li key={f.documentId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/documents/${f.documentId}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">
                    {f.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {f.author} · {f.domain}
                  </p>
                </div>
                <Link href={`/read/${f.documentId}`} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
                  {t.common.open}
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Languages} title={t.dashboard.translations} empty={translations.length === 0 ? t.dashboard.emptyTranslations : null}>
          <ul className="divide-y divide-slate-100">
            {translations.map((tr, i) => (
              <li key={`${tr.documentId}-${i}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{tr.title}</p>
                  <p className="text-xs text-slate-500">
                    {t.common.page} {tr.pageNumber} → {langName(tr.targetLanguage)} · {formatDateTime(tr.createdAt, dateLocale)}
                  </p>
                </div>
                <Link href={`/read/${tr.documentId}?page=${tr.pageNumber}&lang=${tr.targetLanguage}`} className="shrink-0 text-sm font-medium text-brand-700 hover:underline">
                  {t.common.open}
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Inbox} title={t.dashboard.requests} empty={requests.length === 0 ? t.dashboard.emptyRequests : null} link={{ href: "/dashboard/requests", label: t.common.seeAll }}>
          <ul className="divide-y divide-slate-100">
            {requests.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{r.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(r.createdAt, dateLocale)}</p>
                </div>
                <Badge tone={requestStatus[r.status].tone}>{requestStatus[r.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-semibold text-slate-900">{t.dashboard.preferences}</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">{t.settings.uiLocale}</dt>
            <dd className="font-medium text-slate-900">{(user.preferences.uiLocale ?? locale).toUpperCase()}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.settings.readingLanguage}</dt>
            <dd className="font-medium text-slate-900">{user.preferences.preferredReadingLanguage ? langName(user.preferences.preferredReadingLanguage) : t.settings.noPreference}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.settings.summaryLanguage}</dt>
            <dd className="font-medium text-slate-900">{user.preferences.summaryLanguage ? langName(user.preferences.summaryLanguage) : t.settings.noPreference}</dd>
          </div>
        </dl>
        <Link href="/dashboard/settings" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
          {t.nav.settings} →
        </Link>
      </Card>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  empty,
  link,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  empty: string | null;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
          {title}
        </h2>
        {link && (
          <Link href={link.href} className="text-sm text-brand-700 hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      <div className="mt-2">{empty ? <p className="py-6 text-center text-sm text-slate-500">{empty}</p> : children}</div>
    </Card>
  );
}
