import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n/server";
import { listOwnRequests } from "@/lib/services/activity";
import { DOMAINS } from "@/lib/validation/documents";
import { Badge, Card, EmptyState, formatDateTime, PageHeader } from "@/components/ui";
import { RequestForm } from "@/components/requests/RequestForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demandes de documents" };

export default async function RequestsPage() {
  const user = await requireUser("/dashboard/requests");
  const [{ t, locale }, requests] = await Promise.all([getT(), listOwnRequests(user.id)]);
  const dateLocale = locale === "fr" ? "fr-FR" : "en-GB";
  const status: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
    pending: { label: t.requests.statusPending, tone: "warning" },
    accepted: { label: t.requests.statusAccepted, tone: "success" },
    refused: { label: t.requests.statusRefused, tone: "danger" },
  };
  return (
    <div>
      <PageHeader title={t.requests.title} subtitle={t.requests.subtitle} />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-slate-900">{t.requests.formTitle}</h2>
          <RequestForm t={t.requests} domains={DOMAINS} />
        </Card>
        <section aria-labelledby="my-requests">
          <h2 id="my-requests" className="mb-4 font-semibold text-slate-900">
            {t.dashboard.requests}
          </h2>
          {requests.length === 0 ? (
            <EmptyState title={t.dashboard.emptyRequests} />
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{r.title}</p>
                        <p className="text-sm text-slate-600">
                          {[r.author, r.domain].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Badge tone={status[r.status].tone}>{status[r.status].label}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{r.description}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(r.createdAt, dateLocale)}</p>
                    {r.adminResponse && (
                      <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.requests.response}</p>
                        <p className="mt-1 text-slate-800">{r.adminResponse}</p>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
