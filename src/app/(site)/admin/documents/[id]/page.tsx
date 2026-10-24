import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { canEditDocument, roleHas } from "@/lib/authz/permissions";
import { getEnv } from "@/lib/env";
import { getDocumentById } from "@/lib/services/documents";
import { listLanguages } from "@/lib/services/languages";
import { DISTRIBUTABLE_LICENSES } from "@/lib/validation/documents";
import { Alert, Badge, ButtonLink, Card, formatBytes, formatDateTime, PageHeader } from "@/components/ui";
import { DocumentForm } from "@/components/admin/DocumentForm";
import { ActionButton } from "@/components/admin/ActionButton";

export default async function AdminDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("admin:access", "/admin/documents");
  const { id } = await params;
  const doc = await getDocumentById(id);
  if (!doc) notFound();
  if (!canEditDocument(user.role, user.id, doc.createdBy)) redirect("/forbidden");
  const languages = await listLanguages();
  const canApprove = roleHas(user.role, "documents:approve-distribution");
  const canPublish = roleHas(user.role, "documents:publish");
  const canRemove = roleHas(user.role, "documents:remove");
  const licenceOk = DISTRIBUTABLE_LICENSES.has(doc.license);
  const base = `/api/admin/documents/${doc.id}`;

  return (
    <div>
      <PageHeader
        title={doc.title}
        subtitle={`${doc.author} · ${doc.pageCount} pages · ${formatBytes(doc.fileSize)} · ${doc.hasTextLayer === false ? "sans couche texte (OCR requis)" : "couche texte détectée"}`}
        actions={
          <>
            <ButtonLink href={`/read/${doc.id}`} variant="secondary">
              Ouvrir dans le lecteur
            </ButtonLink>
            <Link href="/admin/documents" className="self-center text-sm text-slate-600 hover:underline">
              ← Liste
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Métadonnées</h2>
          <DocumentForm
            languages={languages.map((l) => ({ code: l.code, name: l.name }))}
            maxUploadBytes={getEnv().MAX_UPLOAD_BYTES}
            existing={{
              id: doc.id,
              title: doc.title,
              subtitle: doc.subtitle,
              author: doc.author,
              description: doc.description,
              domain: doc.domain,
              level: doc.level,
              keywords: doc.keywords,
              sourceLanguage: doc.sourceLanguage,
              license: doc.license,
              licenseNotes: doc.licenseNotes,
              sourceUrl: doc.sourceUrl,
              allowDownload: doc.allowDownload,
            }}
          />
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-slate-900">Diffusion et licence</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Licence</dt>
                <dd className="font-medium">{doc.license}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Diffusion</dt>
                <dd>
                  <Badge tone={doc.distributionStatus === "approved" ? "success" : doc.distributionStatus === "refused" ? "danger" : "warning"}>{doc.distributionStatus}</Badge>
                </dd>
              </div>
              {doc.distributionCheckedAt && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Vérifié le</dt>
                  <dd>{formatDateTime(doc.distributionCheckedAt)}</dd>
                </div>
              )}
            </dl>
            {!licenceOk && <Alert tone="warning" className="mt-3">Licence insuffisante : l&apos;approbation et la publication sont bloquées.</Alert>}
            {canApprove ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton url={`${base}/distribution`} body={{ distributionStatus: "approved" }} label="Approuver la diffusion" variant="primary" confirm="Confirmez-vous que ce document peut être diffusé sur la plateforme conformément à sa licence ?" />
                <ActionButton url={`${base}/distribution`} body={{ distributionStatus: "refused" }} label="Refuser" variant="danger" prompt={{ label: "Motif du refus", key: "note", required: true }} />
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Seul un administrateur peut approuver la diffusion.</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-900">Publication</h2>
            <p className="mt-2 text-sm">
              Statut : <Badge tone={doc.status === "published" ? "success" : doc.status === "removed" ? "danger" : "neutral"}>{doc.status}</Badge>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canPublish && doc.status !== "published" && doc.status !== "removed" && (
                <ActionButton url={`${base}/status`} body={{ status: "published" }} label="Publier" variant="primary" />
              )}
              {doc.status === "published" && <ActionButton url={`${base}/status`} body={{ status: "draft" }} label="Dépublier (brouillon)" />}
              {doc.status !== "archived" && doc.status !== "removed" && <ActionButton url={`${base}/status`} body={{ status: "archived" }} label="Archiver" />}
              {canRemove && doc.status !== "removed" && (
                <ActionButton url={`${base}/status`} body={{ status: "removed" }} label="Retirer" variant="danger" confirm="Retirer définitivement ce document de la plateforme ?" />
              )}
            </div>
          </Card>

          {roleHas(user.role, "translation-cache:manage") && (
            <Card className="p-5">
              <h2 className="font-semibold text-slate-900">Cache</h2>
              <p className="mt-1 text-xs text-slate-500">Invalide toutes les traductions et résumés en cache pour ce document.</p>
              <div className="mt-3">
                <ActionButton url="/api/admin/translation-cache/invalidate" body={{ documentId: doc.id, includeSummaries: true }} label="Invalider le cache du document" variant="secondary" />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
