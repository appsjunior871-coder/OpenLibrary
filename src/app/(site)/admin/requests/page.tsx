import { requirePermission } from "@/lib/auth/guards";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/db/schema";
import { listAllRequests } from "@/lib/services/activity";
import { Badge, Card, EmptyState, PageHeader, formatDateTime, buttonClasses, cx } from "@/components/ui";
import { ActionButton } from "@/components/admin/ActionButton";
import Link from "next/link";

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("document-requests:review", "/admin/requests");
  const sp = await searchParams;
  const status = (REQUEST_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as RequestStatus) : undefined;
  const items = await listAllRequests({ status });
  const tone: Record<string, "warning" | "success" | "danger"> = { pending: "warning", accepted: "success", refused: "danger" };

  return (
    <div>
      <PageHeader title="Demandes de documents" subtitle="Acceptez ou refusez en indiquant une justification visible par l'étudiant." />
      <div className="mb-4 flex gap-2">
        {[undefined, ...REQUEST_STATUSES].map((s) => (
          <Link key={s ?? "all"} href={s ? `/admin/requests?status=${s}` : "/admin/requests"} className={cx(buttonClasses("secondary", "sm"), status === s && "bg-slate-800 text-white hover:bg-slate-800")}>
            {s ?? "Toutes"}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <ul className="space-y-3">
          {items.map(({ request: r, requesterName, requesterEmail }) => (
            <li key={r.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{r.title}</p>
                    <p className="text-sm text-slate-600">{[r.author, r.domain].filter(Boolean).join(" · ")}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {requesterName} ({requesterEmail}) · {formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <Badge tone={tone[r.status]}>{r.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-800">{r.description}</p>
                {r.adminResponse && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">Réponse : {r.adminResponse}</p>}
                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <ActionButton url={`/api/admin/requests/${r.id}`} method="PATCH" body={{ status: "accepted" }} label="Accepter" variant="primary" prompt={{ label: "Réponse à l'étudiant (obligatoire)", key: "response", required: true }} />
                    <ActionButton url={`/api/admin/requests/${r.id}`} method="PATCH" body={{ status: "refused" }} label="Refuser" variant="danger" prompt={{ label: "Justification du refus (obligatoire)", key: "response", required: true }} />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
