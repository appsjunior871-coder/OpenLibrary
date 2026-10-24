"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Alert, Button, Input, Select, Spinner } from "@/components/ui";
import type { ReaderDictionary, ReaderLanguage, SummaryState } from "./types";
import { readApiError } from "./types";

type Props = {
  documentId: string;
  pageCount: number;
  currentPage: number;
  languages: ReaderLanguage[];
  defaultLanguage: string;
  onClose: () => void;
  t: ReaderDictionary;
};

const MAX_RANGE = 30;

export function SummaryPanel({ documentId, pageCount, currentPage, languages, defaultLanguage, onClose, t }: Props) {
  const [start, setStart] = useState(currentPage);
  const [end, setEnd] = useState(Math.min(pageCount, currentPage + 4));
  const [language, setLanguage] = useState(defaultLanguage);
  const [state, setState] = useState<SummaryState>({ status: "idle" });
  const summaryLangs = languages.filter((l) => l.supportsSummary);
  const dir = languages.find((l) => l.code === language)?.direction ?? "ltr";
  const rangeInvalid = start < 1 || end > pageCount || end < start || end - start + 1 > MAX_RANGE;

  async function generate() {
    if (rangeInvalid) return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/summaries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId, startPage: start, endPage: end, language }),
      });
      if (!res.ok) {
        const err = await readApiError(res);
        setState({ status: "error", ...err });
        return;
      }
      setState({ status: "ready", data: await res.json() });
    } catch {
      setState({ status: "error", code: "network", message: t.common.error });
    }
  }

  return (
    <section aria-label={t.reader.summaryTitle} className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-accent-500" aria-hidden="true" />
          {t.reader.summaryTitle}
        </p>
        <button type="button" onClick={onClose} title={t.reader.closePanel} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t.reader.closePanel}</span>
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
          className="space-y-3"
        >
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-slate-600">
              {t.reader.summaryRange} (max {MAX_RANGE})
            </legend>
            <div className="flex items-center gap-2">
              <label htmlFor="sum-start" className="sr-only">
                Start
              </label>
              <Input id="sum-start" type="number" min={1} max={pageCount} value={start} onChange={(e) => setStart(Number(e.target.value))} className="w-24" />
              <span className="text-slate-500">→</span>
              <label htmlFor="sum-end" className="sr-only">
                End
              </label>
              <Input id="sum-end" type="number" min={1} max={pageCount} value={end} onChange={(e) => setEnd(Number(e.target.value))} className="w-24" />
              <span className="text-xs text-slate-500">/ {pageCount}</span>
            </div>
          </fieldset>
          <div>
            <label htmlFor="sum-lang" className="mb-1 block text-xs font-medium text-slate-600">
              {t.reader.summaryLanguage}
            </label>
            <Select id="sum-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {summaryLangs.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="accent" disabled={rangeInvalid || state.status === "loading"} className="w-full">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t.reader.summaryGenerate}
          </Button>
        </form>

        <div className="mt-5">
          {state.status === "loading" && <Spinner label={t.reader.summaryLoading} />}
          {state.status === "error" && (
            <Alert tone={state.code === "no_text" || state.code === "not_configured" ? "warning" : "danger"} title={state.code === "no_text" ? t.reader.noText : t.common.error}>
              {state.message}
            </Alert>
          )}
          {state.status === "ready" && (
            <article className="space-y-3">
              <p className="text-xs text-slate-500">
                {t.common.pages} {state.data.startPage}–{state.data.endPage} · {state.data.fromCache ? t.reader.fromCache : state.data.provider} · {state.data.inputChars} car.
              </p>
              {state.data.truncated && <Alert tone="warning">{t.reader.summaryTruncated}</Alert>}
              {state.data.pagesWithoutText.length > 0 && (
                <Alert tone="info">
                  {t.reader.summaryPagesWithoutText} {state.data.pagesWithoutText.join(", ")}
                </Alert>
              )}
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900" dir={dir} lang={state.data.language}>
                {state.data.summary}
              </div>
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{t.common.disclaimer}</p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
