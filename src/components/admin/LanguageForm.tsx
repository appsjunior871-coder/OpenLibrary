"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function NewLanguageForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    setPending(true);
    setError(null);
    const form = new FormData(el);
    const res = await fetch("/api/admin/languages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        name: form.get("name"),
        nativeName: form.get("nativeName"),
        direction: form.get("direction"),
        isActive: false,
        sortOrder: 100,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.details?.[0]?.message ?? data?.error?.message ?? "Erreur");
      return;
    }
    el.reset();
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-5" noValidate>
      {error && (
        <div className="sm:col-span-5">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <Field label="Code" htmlFor="lang-code">
        <Input id="lang-code" name="code" placeholder="de" required maxLength={8} />
      </Field>
      <Field label="Nom (FR)" htmlFor="lang-name">
        <Input id="lang-name" name="name" placeholder="Allemand" required />
      </Field>
      <Field label="Nom natif" htmlFor="lang-native">
        <Input id="lang-native" name="nativeName" placeholder="Deutsch" required />
      </Field>
      <Field label="Direction" htmlFor="lang-dir">
        <Select id="lang-dir" name="direction" defaultValue="ltr">
          <option value="ltr">LTR</option>
          <option value="rtl">RTL</option>
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          Ajouter (inactive)
        </Button>
      </div>
    </form>
  );
}
