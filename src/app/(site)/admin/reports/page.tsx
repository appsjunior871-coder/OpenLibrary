import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { REPORT_STATUSES, type ReportStatus } from "@/lib/db/schema";
import { listReports } from "@/lib/services/activity";
import { Badge, Card, EmptyState, PageHeader, formatDateTime, buttonClasses, cx } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("translation-reports:review", "/admin/reports");
  const sp = await searchParams;
  const status = (REPORT_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ReportStatus) : undefined;
  const items = await listReports({ status });
  const tone: Record<string, "warning" | "brand" | "success" | "danger"> = { new: "warning", in_progress: "brand", resolved: "success", rejected: "danger" };

  return (
    <div>
      <PageHeader title="Signalements de traduction" subtitle="Nouveau → en cours → résolu / rejeté. Pensez à invalider le cache du segment concerné." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...REPORT_STATUSES].map((s) => (
          <Link key={s ?? "all"} href={s ? `/admin/reports?status=${s}` : "/admin/reports"} className={cx(buttonClasses("secondary", "sm"), status === s && "bg-slate-800 text-white hover:bg-slate-800")}>
            {s ?? "Tous"}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Aucun signalement" />
      ) : (
        <ul className="space-y-3">
          {items.map(({ report: r, reporterName, documentTitle }) => (
            <li key={r.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/read/${r.documentId}?page=${r.pageNumber}&lang=${r.targetLanguage}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {documentTitle}
                    </Link>
                    <p className="text-sm text-slate-600">
                      Page {r.pageNumber}
                      {r.segmentIndex !== null ? `, segment ${r.segmentIndex + 1}` : ""} → {r.targetLanguage.toUpperCase()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {reporterName} · {formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <Badge tone={tone[r.status]}>{r.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-800">{r.description}</p>
                {r.adminResponse && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">Réponse : {r.adminResponse}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === "new" && <ActionButton url={`/api/admin/reports/${r.id}`} method="PATCH" body={{ status: "in_progress" }} label="Prendre en charge" />}
                  {(r.status === "new" || r.status === "in_progress") && (
                    <>
                      <ActionButton url={`/api/admin/reports/${r.id}`} method="PATCH" body={{ status: "resolved" }} label="Résolu" variant="primary" prompt={{ label: "Réponse (optionnelle)", key: "response" }} />
                      <ActionButton url={`/api/admin/reports/${r.id}`} method="PATCH" body={{ status: "rejected" }} label="Rejeter" variant="danger" prompt={{ label: "Motif (optionnel)", key: "response" }} />
                      <ActionButton
                        url="/api/admin/translation-cache/invalidate"
                        body={{ documentId: r.documentId, pageNumber: r.pageNumber, targetLanguage: r.targetLanguage }}
                        label="Invalider le cache de cette page"
                        variant="ghost"
                      />
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
