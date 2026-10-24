"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { UserPreferences } from "@/lib/db/schema";

type Lang = { code: string; name: string };

async function postJson(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

export function PreferencesForm({
  t,
  languages,
  initial,
  displayName,
}: {
  t: Dictionary["settings"];
  languages: Lang[];
  initial: UserPreferences;
  displayName: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = new FormData(e.currentTarget);
    const { ok, data } = await postJson("/api/me", "PATCH", {
      displayName: form.get("displayName"),
      preferences: {
        uiLocale: form.get("uiLocale"),
        preferredReadingLanguage: form.get("preferredReadingLanguage") || null,
        summaryLanguage: form.get("summaryLanguage") || null,
        readerLayout: form.get("readerLayout"),
      },
    });
    setPending(false);
    setMsg(ok ? { tone: "success", text: "✓" } : { tone: "danger", text: data?.error?.message ?? "Erreur" });
    if (ok) {
      document.cookie = `ol_locale=${form.get("uiLocale")}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Field label="Nom d'affichage" htmlFor="displayName">
        <Input id="displayName" name="displayName" defaultValue={displayName} minLength={2} maxLength={80} required />
      </Field>
      <Field label={t.uiLocale} htmlFor="uiLocale">
        <Select id="uiLocale" name="uiLocale" defaultValue={initial.uiLocale ?? "fr"}>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Field label={t.readingLanguage} htmlFor="preferredReadingLanguage">
        <Select id="preferredReadingLanguage" name="preferredReadingLanguage" defaultValue={initial.preferredReadingLanguage ?? ""}>
          <option value="">{t.noPreference}</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.summaryLanguage} htmlFor="summaryLanguage">
        <Select id="summaryLanguage" name="summaryLanguage" defaultValue={initial.summaryLanguage ?? ""}>
          <option value="">{t.noPreference}</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.readerLayout} htmlFor="readerLayout">
        <Select id="readerLayout" name="readerLayout" defaultValue={initial.readerLayout ?? "side"}>
          <option value="side">{t.layoutSide}</option>
          <option value="below">{t.layoutBelow}</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Enregistrer"}
      </Button>
    </form>
  );
}

export function PasswordForm({ t }: { t: Dictionary["settings"] }) {
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setPending(true);
    const form = new FormData(formEl);
    const { ok, data } = await postJson("/api/me/password", "POST", {
      currentPassword: form.get("currentPassword"),
      newPassword: form.get("newPassword"),
    });
    setPending(false);
    setMsg(ok ? { tone: "success", text: "✓" } : { tone: "danger", text: data?.error?.details?.[0]?.message ?? data?.error?.message ?? "Erreur" });
    if (ok) formEl.reset();
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Field label={t.currentPassword} htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label={t.newPassword} htmlFor="newPassword">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t.password}
      </Button>
    </form>
  );
}

export function DeleteAccountForm({ t }: { t: Dictionary["settings"] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = new FormData(e.currentTarget);
    const { ok, data } = await postJson("/api/me", "DELETE", { password: form.get("password"), confirmation: form.get("confirmation") });
    setPending(false);
    if (!ok) {
      setMsg(data?.error?.message ?? "Erreur");
      return;
    }
    router.push("/");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Alert tone="warning">{t.deleteWarning}</Alert>
      {msg && <Alert tone="danger">{msg}</Alert>}
      <Field label={t.currentPassword} htmlFor="del-password">
        <Input id="del-password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Field label={t.deleteConfirmLabel} htmlFor="confirmation">
        <Input id="confirmation" name="confirmation" required pattern="SUPPRIMER" />
      </Field>
      <Button type="submit" variant="danger" disabled={pending}>
        {t.deleteAccount}
      </Button>
    </form>
  );
}
