import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Download, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getDocumentForViewer } from "@/lib/services/documents";
import { Alert, Badge, ButtonLink, Card, formatBytes, formatDate } from "@/components/ui";
import { FavoriteButton } from "@/components/FavoriteButton";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: "Document" };
  const doc = await getDocumentForViewer(id, await getCurrentUser());
  return { title: doc ? doc.title : "Document" };
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);
  const doc = await getDocumentForViewer(id, user);
  if (!doc) notFound();
  const levelLabel = t.levels[doc.level as keyof typeof t.levels] ?? doc.level;

  return (
    <article className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{doc.domain}</Badge>
          <Badge>{levelLabel}</Badge>
          {doc.status !== "published" && <Badge tone="warning">{doc.status}</Badge>}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{doc.title}</h1>
        {doc.subtitle && <p className="mt-1 text-lg text-slate-600">{doc.subtitle}</p>}
        <p className="mt-2 text-base text-slate-700">{doc.author}</p>

        <section className="mt-6" aria-labelledby="desc">
          <h2 id="desc" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.common.description}
          </h2>
          <p className="mt-2 whitespace-pre-line text-slate-800">{doc.description || "—"}</p>
        </section>

        {doc.keywords.length > 0 && (
          <section className="mt-6" aria-labelledby="kw">
            <h2 id="kw" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t.common.keywords}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {doc.keywords.map((k) => (
                <li key={k}>
                  <Link href={`/catalog?keyword=${encodeURIComponent(k)}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200">
                    {k}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8">
          <Alert tone="info">{t.common.disclaimer}</Alert>
        </div>
      </div>

      <aside>
        <Card className="p-5">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t.common.sourceLanguage}</dt>
              <dd className="font-medium text-slate-900">{doc.sourceLanguageName ?? doc.sourceLanguage.toUpperCase()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t.common.pages}</dt>
              <dd className="font-medium text-slate-900">{doc.pageCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t.document.fileSize}</dt>
              <dd className="font-medium text-slate-900">{formatBytes(doc.fileSize)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t.common.license}</dt>
              <dd className="font-medium text-slate-900">{doc.license}</dd>
            </div>
            {doc.publishedAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t.document.publishedOn}</dt>
                <dd className="font-medium text-slate-900">{formatDate(doc.publishedAt, locale === "fr" ? "fr-FR" : "en-GB")}</dd>
              </div>
            )}
            {doc.sourceUrl && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t.document.source}</dt>
                <dd>
                  <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    {new URL(doc.sourceUrl).hostname} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 space-y-2">
            {user && doc.canOpen ? (
              <>
                <ButtonLink href={`/read/${doc.id}`} className="w-full">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  {doc.history && doc.history.lastPage > 1 ? `${t.document.resume} ${doc.history.lastPage}` : t.document.open}
                </ButtonLink>
                {doc.canDownload ? (
                  <a href={`/api/documents/${doc.id}/file?download=1`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t.document.download}
                  </a>
                ) : (
                  <p className="text-xs text-slate-500">{t.document.noDownload}</p>
                )}
                <FavoriteButton documentId={doc.id} initial={doc.isFavorite} labels={{ add: t.document.favorite, remove: t.document.unfavorite }} />
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">{t.document.visitorNotice}</p>
                <ButtonLink href={`/login?next=/read/${doc.id}`} className="w-full">
                  {t.nav.login}
                </ButtonLink>
                <ButtonLink href="/register" variant="secondary" className="w-full">
                  {t.nav.register}
                </ButtonLink>
              </>
            )}
          </div>
        </Card>
      </aside>
    </article>
  );
}
