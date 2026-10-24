import Link from "next/link";
import { Search, BookOpen, Languages, Sparkles, ShieldCheck, FileText } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { getCatalogFacets, listFeaturedDocuments } from "@/lib/services/documents";
import { listActiveTranslationLanguages } from "@/lib/services/languages";
import { ButtonLink, Card, EmptyState, Input } from "@/components/ui";
import { DocumentCard } from "@/components/DocumentCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ t }, user, featured, facets, languages] = await Promise.all([
    getT(),
    getCurrentUser(),
    listFeaturedDocuments(6),
    getCatalogFacets(),
    listActiveTranslationLanguages(),
  ]);
  const publishedCount = facets.domains.reduce((n, d) => n + d.count, 0);

  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{t.app.tagline}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">{t.home.heroTitle}</h1>
          <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">{t.home.heroBody}</p>
          <form action="/catalog" method="get" role="search" className="mt-8 flex max-w-xl gap-2">
            <label htmlFor="home-search" className="sr-only">
              {t.common.search}
            </label>
            <Input id="home-search" name="q" placeholder={t.common.searchPlaceholder} className="h-12 text-base" />
            <button type="submit" className="inline-flex h-12 items-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t.common.search}</span>
            </button>
          </form>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/catalog" variant="secondary">
              {t.home.ctaCatalog}
            </ButtonLink>
            {!user && (
              <ButtonLink href="/register" variant="accent">
                {t.home.ctaRegister}
              </ButtonLink>
            )}
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-slate-200 pt-6 text-sm">
            <div>
              <dt className="text-slate-500">{t.home.statsDocuments}</dt>
              <dd className="text-2xl font-bold text-slate-900">{publishedCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.home.statsLanguages}</dt>
              <dd className="text-2xl font-bold text-slate-900">{languages.length}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.home.statsDomains}</dt>
              <dd className="text-2xl font-bold text-slate-900">{facets.domains.length}</dd>
            </div>
          </dl>
        </div>

        {/* Reader illustration (static, honest mock-up of the toolbar) */}
        <div aria-hidden="true" className="hidden lg:block">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              <span className="font-medium">Introduction to Algorithms</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-white">
                <Languages className="h-3.5 w-3.5" /> {t.reader.translate}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-slate-200">
              <div className="space-y-2 p-4">
                <p className="text-[10px] font-semibold uppercase text-slate-400">English · original</p>
                <div className="h-2 w-11/12 rounded bg-slate-200" />
                <div className="h-2 w-full rounded bg-slate-200" />
                <div className="h-2 w-10/12 rounded bg-slate-200" />
                <div className="h-2 w-full rounded bg-slate-200" />
                <div className="h-2 w-8/12 rounded bg-slate-200" />
              </div>
              <div className="space-y-2 p-4">
                <p className="text-[10px] font-semibold uppercase text-brand-600">Français · traduction</p>
                <div className="h-2 w-10/12 rounded bg-brand-100" />
                <div className="h-2 w-full rounded bg-brand-100" />
                <div className="h-2 w-11/12 rounded bg-brand-100" />
                <div className="h-2 w-full rounded bg-brand-100" />
                <div className="h-2 w-7/12 rounded bg-brand-100" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-title">
        <h2 id="how-title" className="text-2xl font-bold text-slate-900">
          {t.home.howTitle}
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Search, title: t.home.step1Title, body: t.home.step1Body },
            { icon: BookOpen, title: t.home.step2Title, body: t.home.step2Body },
            { icon: Languages, title: t.home.step3Title, body: t.home.step3Body },
            { icon: Sparkles, title: t.home.step4Title, body: t.home.step4Body },
          ].map((s) => (
            <li key={s.title}>
              <Card className="h-full p-5">
                <s.icon className="h-6 w-6 text-brand-600" aria-hidden="true" />
                <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Domains */}
      <section aria-labelledby="domains-title">
        <div className="flex items-end justify-between">
          <h2 id="domains-title" className="text-2xl font-bold text-slate-900">
            {t.home.domainsTitle}
          </h2>
          <Link href="/catalog" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            {t.common.seeAll} →
          </Link>
        </div>
        {facets.domains.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t.home.featuredEmpty}</p>
        ) : (
          <ul className="mt-6 flex flex-wrap gap-2">
            {facets.domains.map((d) => (
              <li key={d.value}>
                <Link
                  href={`/catalog?domain=${encodeURIComponent(d.value)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:border-brand-400 hover:text-brand-800"
                >
                  {d.value}
                  <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">{d.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Featured */}
      <section aria-labelledby="featured-title">
        <h2 id="featured-title" className="text-2xl font-bold text-slate-900">
          {t.home.featuredTitle}
        </h2>
        {featured.length === 0 ? (
          <div className="mt-6">
            <EmptyState title={t.home.featuredEmpty} />
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((d) => (
              <li key={d.id}>
                <DocumentCard doc={d} t={t} loggedIn={Boolean(user)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Benefits + limits */}
      <section aria-labelledby="benefits-title" className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 id="benefits-title" className="text-2xl font-bold text-slate-900">
            {t.home.benefitsTitle}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              { icon: FileText, title: t.home.benefit1Title, body: t.home.benefit1Body },
              { icon: Languages, title: t.home.benefit2Title, body: t.home.benefit2Body },
              { icon: Sparkles, title: t.home.benefit3Title, body: t.home.benefit3Body },
              { icon: ShieldCheck, title: t.home.benefit4Title, body: t.home.benefit4Body },
            ].map((b) => (
              <li key={b.title} className="flex gap-3">
                <b.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-slate-900">{b.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <Card className="bg-amber-50/60 p-6">
          <h2 className="font-semibold text-slate-900">{t.home.limitsTitle}</h2>
          <p className="mt-2 text-sm text-slate-700">{t.home.limitsBody}</p>
          <p className="mt-3 text-xs text-slate-500">{t.common.disclaimer}</p>
        </Card>
      </section>
    </div>
  );
}
