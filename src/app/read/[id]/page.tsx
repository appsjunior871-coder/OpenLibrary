import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n/server";
import { PdfReader } from "@/components/reader/PdfReader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lecteur" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reader page. Access rights are verified again by the API (`/open`, `/file`, `/translations`):
 * this shell only makes sure visitors are sent to the login page.
 */
export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; lang?: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const user = await requireUser(`/read/${id}`);
  const [{ t, locale }, sp] = await Promise.all([getT(), searchParams]);
  const initialPage = sp.page ? Number.parseInt(sp.page, 10) : null;
  return (
    <PdfReader
      documentId={id}
      initialPage={initialPage && Number.isFinite(initialPage) ? initialPage : null}
      initialLang={sp.lang && /^[a-z]{2,3}(-[a-z]{2,4})?$/i.test(sp.lang) ? sp.lang : null}
      preferredLanguage={user.preferences.preferredReadingLanguage ?? null}
      summaryLanguage={user.preferences.summaryLanguage ?? null}
      layout={user.preferences.readerLayout ?? "side"}
      uiLocale={locale}
      t={{ reader: t.reader, common: t.common }}
    />
  );
}
