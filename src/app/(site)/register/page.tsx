import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { Card } from "@/components/ui";
import { RegisterForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function RegisterPage() {
  const [{ t }, user] = await Promise.all([getT(), getCurrentUser()]);
  if (user) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">{t.auth.registerTitle}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.auth.registerSubtitle}</p>
      <Card className="mt-6 p-6">
        <RegisterForm t={t.auth} />
      </Card>
    </div>
  );
}
