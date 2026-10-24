"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

type Props = {
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md";
  confirm?: string;
  prompt?: { label: string; key: string; required?: boolean };
  onDone?: () => void;
};

/** Small client helper: calls a JSON API route, shows the server error, refreshes the server component tree. */
export function ActionButton({ url, method = "POST", body, label, variant = "secondary", size = "sm", confirm, prompt, onDone }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    let payload = (body ?? {}) as Record<string, unknown>;
    if (prompt) {
      const value = window.prompt(prompt.label, "");
      if (value === null) return;
      if (prompt.required && !value.trim()) return;
      payload = { ...payload, [prompt.key]: value };
    }
    setPending(true);
    setError(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error?.message ?? `Erreur ${res.status}`);
      return;
    }
    onDone?.();
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" size={size} variant={variant} onClick={run} disabled={pending}>
        {pending ? "…" : label}
      </Button>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
