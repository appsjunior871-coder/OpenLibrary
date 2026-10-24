import { requirePermission } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { listLanguages } from "@/lib/services/languages";
import { Alert, Card, PageHeader } from "@/components/ui";
import { DocumentForm } from "@/components/admin/DocumentForm";

export default async function NewDocumentPage() {
  await requirePermission("documents:create", "/admin/documents/new");
  const languages = await listLanguages();
  return (
    <div>
      <PageHeader title="Ajouter un document" subtitle="Le document est créé en brouillon. Sa diffusion doit ensuite être vérifiée par un administrateur avant publication." />
      <Alert tone="warning" className="mb-6">
        Ne considérez pas qu&apos;un PDF accessible sur Internet est libre de droits. Renseignez la licence réelle et conservez la preuve d&apos;autorisation dans les notes.
      </Alert>
      <Card className="p-6">
        <DocumentForm languages={languages.map((l) => ({ code: l.code, name: l.name }))} maxUploadBytes={getEnv().MAX_UPLOAD_BYTES} />
      </Card>
    </div>
  );
}
