"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ApiError = { error: { code: string; message: string; details: { path: string; message: string }[] | null } };

function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function LoginForm({ t, next }: { t: Dictionary["auth"]; next: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as ApiError | null;
      setError(data?.error.message ?? "Erreur de connexion.");
      return;
    }
    const data = (await res.json()) as { user: { role: string } };
    const target = safeNext(next) ?? (data.user.role === "student" ? "/dashboard" : "/admin");
    router.push(target);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t.password} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "…" : t.submitLogin}
      </Button>
      <p className="text-center text-sm text-slate-600">
        {t.noAccount}{" "}
        <Link href="/register" className="font-medium text-brand-700 hover:underline">
          {t.registerTitle}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ t }: { t: Dictionary["auth"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        email: form.get("email"),
        password: form.get("password"),
        passwordConfirmation: form.get("passwordConfirmation"),
        acceptTerms: form.get("acceptTerms") === "on",
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as ApiError | null;
      if (data?.error.details && Array.isArray(data.error.details)) {
        const fe: Record<string, string> = {};
        for (const d of data.error.details) fe[d.path] = d.message;
        setFieldErrors(fe);
      }
      setError(data?.error.message ?? "Erreur d'inscription.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t.displayName} htmlFor="displayName" error={fieldErrors.displayName}>
        <Input id="displayName" name="displayName" autoComplete="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label={t.email} htmlFor="email" error={fieldErrors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t.password} htmlFor="password" hint={t.passwordHint} error={fieldErrors.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label={t.passwordConfirmation} htmlFor="passwordConfirmation" error={fieldErrors.passwordConfirmation}>
        <Input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" required />
      </Field>
      <div className="flex items-start gap-2">
        <input id="acceptTerms" name="acceptTerms" type="checkbox" required className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600" />
        <label htmlFor="acceptTerms" className="text-sm text-slate-700">
          {t.acceptTerms}
        </label>
      </div>
      {fieldErrors.acceptTerms && (
        <p className="text-xs text-red-600" role="alert">
          {fieldErrors.acceptTerms}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "…" : t.submitRegister}
      </Button>
      <p className="text-center text-sm text-slate-600">
        {t.hasAccount}{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          {t.loginTitle}
        </Link>
      </p>
    </form>
  );
}
