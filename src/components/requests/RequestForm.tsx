"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function RequestForm({ t, domains }: { t: Dictionary["requests"]; domains: readonly string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setPending(true);
    setError(null);
    setOk(false);
    const form = new FormData(formEl);
    const res = await fetch("/api/document-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        author: form.get("author") || null,
        domain: form.get("domain") || null,
        description: form.get("description"),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.details?.[0]?.message ?? data?.error?.message ?? "Erreur");
      return;
    }
    formEl.reset();
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      {ok && <Alert tone="success">✓</Alert>}
      <Field label={t.fieldTitle} htmlFor="title">
        <Input id="title" name="title" required minLength={2} maxLength={250} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.fieldAuthor} htmlFor="author">
          <Input id="author" name="author" maxLength={200} />
        </Field>
        <Field label={t.fieldDomain} htmlFor="domain">
          <Select id="domain" name="domain" defaultValue="">
            <option value="">—</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t.fieldDescription} htmlFor="description">
        <Textarea id="description" name="description" rows={4} required minLength={10} maxLength={3000} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : t.submit}
      </Button>
    </form>
  );
}
