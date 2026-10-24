import Link from "next/link";
import { BookOpen, Lock } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type DocumentCardData = {
  id: string;
  title: string;
  subtitle?: string | null;
  author: string;
  domain: string;
  level: string;
  sourceLanguage: string;
  sourceLanguageName?: string | null;
  license: string;
  pageCount: number;
  canOpen?: boolean;
  isFavorite?: boolean;
};

export function DocumentCard({ doc, t, loggedIn }: { doc: DocumentCardData; t: Dictionary; loggedIn: boolean }) {
  const levelLabel = t.levels[doc.level as keyof typeof t.levels] ?? doc.level;
  return (
    <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <Badge tone="brand">{doc.domain}</Badge>
        <span className="text-xs text-slate-500">
          {doc.pageCount} {t.common.pages}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-semibold text-slate-900">
        <Link href={`/documents/${doc.id}`} className="hover:text-brand-700">
          {doc.title}
        </Link>
      </h3>
      {doc.subtitle && <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">{doc.subtitle}</p>}
      <p className="mt-1 text-sm text-slate-600">{doc.author}</p>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <div>
          <dt className="sr-only">{t.common.sourceLanguage}</dt>
          <dd>
            {t.common.sourceLanguage} : <span className="font-medium text-slate-700">{doc.sourceLanguageName ?? doc.sourceLanguage.toUpperCase()}</span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">{t.common.level}</dt>
          <dd>{levelLabel}</dd>
        </div>
        <div>
          <dt className="sr-only">{t.common.license}</dt>
          <dd>{doc.license}</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between pt-4">
        {loggedIn ? (
          <Link href={`/read/${doc.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {t.common.open}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={t.catalog.loginToOpen}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {t.common.accessStudents}
          </span>
        )}
        <Link href={`/documents/${doc.id}`} className="text-sm text-slate-600 hover:text-slate-900">
          {t.catalog.details} →
        </Link>
      </div>
    </Card>
  );
}
