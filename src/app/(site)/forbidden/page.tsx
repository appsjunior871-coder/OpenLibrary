import { ButtonLink } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-red-600">403</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Accès refusé</h1>
      <p className="mt-2 text-slate-600">Vous n&apos;avez pas l&apos;autorisation d&apos;accéder à cette page.</p>
      <div className="mt-6">
        <ButtonLink href="/dashboard" variant="secondary">
          Retour à mon espace
        </ButtonLink>
      </div>
    </div>
  );
}
