import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n/server";
import { listActiveTranslationLanguages } from "@/lib/services/languages";
import { Card, PageHeader } from "@/components/ui";
import { DeleteAccountForm, PasswordForm, PreferencesForm } from "@/components/settings/SettingsForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Préférences" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const [{ t }, languages] = await Promise.all([getT(), listActiveTranslationLanguages()]);
  return (
    <div>
      <PageHeader title={t.settings.title} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-slate-900">{t.dashboard.preferences}</h2>
          <PreferencesForm t={t.settings} languages={languages.map((l) => ({ code: l.code, name: l.name }))} initial={user.preferences} displayName={user.displayName} />
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 font-semibold text-slate-900">{t.settings.password}</h2>
            <PasswordForm t={t.settings} />
          </Card>
          {user.role !== "admin" && (
            <Card className="border-red-200 p-6">
              <h2 className="mb-4 font-semibold text-red-700">{t.settings.deleteAccount}</h2>
              <DeleteAccountForm t={t.settings} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
