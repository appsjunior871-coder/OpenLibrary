import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ t }, user, sp] = await Promise.all([getT(), getCurrentUser(), searchParams]);
  if (user) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/dashboard");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">{t.auth.loginTitle}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.auth.loginSubtitle}</p>
      <Card className="mt-6 p-6">
        <LoginForm t={t.auth} next={sp.next ?? null} />
      </Card>
    </div>
  );
}
