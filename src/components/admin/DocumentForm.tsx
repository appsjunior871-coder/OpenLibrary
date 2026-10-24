"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { DOMAINS, LICENSES, DISTRIBUTABLE_LICENSES } from "@/lib/validation/documents";
import { ACADEMIC_LEVELS } from "@/lib/db/schema";

type Lang = { code: string; name: string };

type Existing = {
  id: string;
  title: string;
  subtitle: string | null;
  author: string;
  description: string;
  domain: string;
  level: string;
  keywords: string[];
  sourceLanguage: string;
  license: string;
  licenseNotes: string | null;
  sourceUrl: string | null;
  allowDownload: boolean;
};

export function DocumentForm({ languages, existing, maxUploadBytes }: { languages: Lang[]; existing?: Existing; maxUploadBytes: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [license, setLicense] = useState(existing?.license ?? "CC BY");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    let res: Response;
    if (existing) {
      const body: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) if (k !== "file") body[k] = v;
      body.allowDownload = form.get("allowDownload") === "on";
      res = await fetch(`/api/admin/documents/${existing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    } else {
      const file = form.get("file") as File | null;
      if (!file || file.size === 0) {
        setError("Sélectionnez un fichier PDF.");
        setPending(false);
        return;
      }
      if (file.size > maxUploadBytes) {
        setError(`Le fichier dépasse ${Math.round(maxUploadBytes / 1024 / 1024)} Mo.`);
        setPending(false);
        return;
      }
      form.set("allowDownload", form.get("allowDownload") === "on" ? "true" : "false");
      res = await fetch("/api/admin/documents", { method: "POST", body: form });
    }
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (Array.isArray(data?.error?.details)) {
        const fe: Record<string, string> = {};
        for (const d of data.error.details) fe[d.path] = d.message;
        setFieldErrors(fe);
      }
      setError(data?.error?.message ?? "Erreur");
      return;
    }
    const data = await res.json();
    router.push(`/admin/documents/${data.document.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      {!existing && (
        <Field label="Fichier PDF" htmlFor="file" hint={`PDF uniquement, ${Math.round(maxUploadBytes / 1024 / 1024)} Mo max. Le fichier est stocké de façon privée et validé côté serveur.`}>
          <input id="file" name="file" type="file" accept="application/pdf,.pdf" required className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-800" />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre" htmlFor="title" error={fieldErrors.title}>
          <Input id="title" name="title" required defaultValue={existing?.title ?? ""} maxLength={250} />
        </Field>
        <Field label="Sous-titre" htmlFor="subtitle">
          <Input id="subtitle" name="subtitle" defaultValue={existing?.subtitle ?? ""} maxLength={250} />
        </Field>
        <Field label="Auteur(s)" htmlFor="author" error={fieldErrors.author}>
          <Input id="author" name="author" required defaultValue={existing?.author ?? ""} maxLength={200} />
        </Field>
        <Field label="Langue originale" htmlFor="sourceLanguage" error={fieldErrors.sourceLanguage}>
          <Select id="sourceLanguage" name="sourceLanguage" defaultValue={existing?.sourceLanguage ?? "en"}>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Domaine" htmlFor="domain" error={fieldErrors.domain}>
          <Select id="domain" name="domain" defaultValue={existing?.domain ?? DOMAINS[0]}>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Niveau" htmlFor="level">
          <Select id="level" name="level" defaultValue={existing?.level ?? "tous"}>
            {ACADEMIC_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={4} defaultValue={existing?.description ?? ""} maxLength={5000} />
      </Field>
      <Field label="Mots-clés (séparés par des virgules)" htmlFor="keywords">
        <Input id="keywords" name="keywords" defaultValue={existing?.keywords.join(", ") ?? ""} />
      </Field>
      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">Licence et diffusion</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Licence déclarée" htmlFor="license" error={fieldErrors.license}>
            <Select id="license" name="license" value={license} onChange={(e) => setLicense(e.target.value)}>
              {LICENSES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Source / provenance (URL)" htmlFor="sourceUrl" error={fieldErrors.sourceUrl}>
            <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={existing?.sourceUrl ?? ""} placeholder="https://" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Notes de vérification (autorisation, courriel de l'auteur, etc.)" htmlFor="licenseNotes">
            <Textarea id="licenseNotes" name="licenseNotes" rows={2} defaultValue={existing?.licenseNotes ?? ""} />
          </Field>
        </div>
        {!DISTRIBUTABLE_LICENSES.has(license) && (
          <Alert tone="warning" className="mt-3">
            Cette licence ne permet pas la diffusion : le document restera en brouillon tant qu&apos;une licence valide n&apos;est pas renseignée et vérifiée.
          </Alert>
        )}
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowDownload" defaultChecked={existing?.allowDownload ?? true} className="h-4 w-4 rounded border-slate-300" />
          Autoriser le téléchargement du PDF par les étudiants
        </label>
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : existing ? "Enregistrer les modifications" : "Téléverser le document (brouillon)"}
      </Button>
    </form>
  );
}
