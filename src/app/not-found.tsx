import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Page introuvable</h1>
      <p className="mt-2 text-slate-600">Le document ou la page demandée n&apos;existe pas ou n&apos;est pas accessible.</p>
      <Link href="/" className="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
