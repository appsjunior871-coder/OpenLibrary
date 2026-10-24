import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getCatalogFacets, searchCatalog } from "@/lib/services/documents";
import { catalogQuerySchema } from "@/lib/validation/documents";
import { Alert, ButtonLink, EmptyState, Input, PageHeader, Select, buttonClasses, cx } from "@/components/ui";
import { DocumentCard } from "@/components/DocumentCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalogue" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = catalogQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);

  let result: Awaited<ReturnType<typeof searchCatalog>> | null = null;
  let facets: Awaited<ReturnType<typeof getCatalogFacets>> | null = null;
  let error: string | null = null;
  try {
    [result, facets] = await Promise.all([searchCatalog(query, user), getCatalogFacets()]);
  } catch (err) {
    console.error("[catalog] load failed", err);
    error = t.common.errorTitle;
  }

  const buildHref = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...flat, ...patch } as Record<string, string | number | undefined>;
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && !(k === "page" && Number(v) <= 1)) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  };

  return (
    <div>
      <PageHeader title={t.catalog.title} subtitle={t.catalog.subtitle} />

      <form method="get" action="/catalog" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" role="search" aria-label={t.catalog.filters}>
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            {t.common.search}
          </label>
          <Input id="q" name="q" defaultValue={query.q ?? ""} placeholder={t.common.searchPlaceholder} />
          <button type="submit" className={buttonClasses("primary", "md")}>
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t.common.search}</span>
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="domain" className="mb-1 block text-xs font-medium text-slate-600">
              {t.common.domain}
            </label>
            <Select id="domain" name="domain" defaultValue={query.domain ?? ""}>
              <option value="">{t.catalog.allDomains}</option>
              {facets?.domains.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.value} ({d.count})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="level" className="mb-1 block text-xs font-medium text-slate-600">
              {t.common.level}
            </label>
            <Select id="level" name="level" defaultValue={query.level ?? ""}>
              <option value="">{t.catalog.allLevels}</option>
              {facets?.levels.map((l) => (
                <option key={l.value} value={l.value}>
                  {t.levels[l.value as keyof typeof t.levels] ?? l.value} ({l.count})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="language" className="mb-1 block text-xs font-medium text-slate-600">
              {t.common.sourceLanguage}
            </label>
            <Select id="language" name="language" defaultValue={query.language ?? ""}>
              <option value="">{t.catalog.allLanguages}</option>
              {facets?.languages.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.name ?? l.value.toUpperCase()} ({l.count})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="author" className="mb-1 block text-xs font-medium text-slate-600">
              {t.common.author}
            </label>
            <Select id="author" name="author" defaultValue={query.author ?? ""}>
              <option value="">{t.catalog.allAuthors}</option>
              {facets?.authors.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.value} ({a.count})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="sort" className="mb-1 block text-xs font-medium text-slate-600">
              {t.catalog.sort}
            </label>
            <Select id="sort" name="sort" defaultValue={query.sort}>
              <option value="recent">{t.catalog.sortRecent}</option>
              <option value="title">{t.catalog.sortTitle}</option>
              <option value="author">{t.catalog.sortAuthor}</option>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <Link href="/catalog" className="text-slate-600 hover:text-slate-900">
            {t.catalog.reset}
          </Link>
          <button type="submit" className={buttonClasses("secondary", "sm")}>
            {t.catalog.filters}
          </button>
        </div>
      </form>

      <div className="mt-6">
        {error && (
          <Alert tone="danger" title={error}>
            <Link href={buildHref({})} className="underline">
              {t.common.retry}
            </Link>
          </Alert>
        )}
        {result && (
          <>
            <p className="mb-4 text-sm text-slate-600" aria-live="polite">
              {result.total} {result.total > 1 ? t.common.results : t.common.result}
            </p>
            {result.items.length === 0 ? (
              <EmptyState
                title={t.common.emptyTitle}
                body={t.common.emptyBody}
                action={
                  <ButtonLink href="/catalog" variant="secondary">
                    {t.catalog.reset}
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((d) => (
                  <li key={d.id}>
                    <DocumentCard doc={d} t={t} loggedIn={Boolean(user)} />
                  </li>
                ))}
              </ul>
            )}
            {result.totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                <Link
                  href={buildHref({ page: result.page - 1 })}
                  aria-disabled={result.page <= 1}
                  className={cx(buttonClasses("secondary", "sm"), result.page <= 1 && "pointer-events-none opacity-50")}
                >
                  {t.common.previous}
                </Link>
                <span className="text-sm text-slate-600">
                  {t.common.page} {result.page} {t.common.of} {result.totalPages}
                </span>
                <Link
                  href={buildHref({ page: result.page + 1 })}
                  aria-disabled={result.page >= result.totalPages}
                  className={cx(buttonClasses("secondary", "sm"), result.page >= result.totalPages && "pointer-events-none opacity-50")}
                >
                  {t.common.next}
                </Link>
              </nav>
            )}
          </>
        )}
      </div>
      <p className="mt-8 text-xs text-slate-500">{locale === "fr" ? "Les documents affichés ont été vérifiés et publiés par un responsable." : "Displayed documents were reviewed and published by a curator."}</p>
    </div>
  );
}
