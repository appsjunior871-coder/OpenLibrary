"use client";

import { useState } from "react";
import { AlertTriangle, Columns2, Flag, RefreshCw, X } from "lucide-react";
import { Alert, Button, Spinner, Textarea, cx } from "@/components/ui";
import type { ReaderDictionary, ReaderLanguage, TranslationState } from "./types";

type Props = {
  state: TranslationState;
  targetLanguage: string | null;
  languages: ReaderLanguage[];
  sourceLanguage: string;
  pageNumber: number;
  documentId: string;
  onRetry: () => void;
  onClose: () => void;
  onBackToOriginal: () => void;
  t: ReaderDictionary;
};

export function TranslationPanel({ state, targetLanguage, languages, sourceLanguage, pageNumber, documentId, onRetry, onClose, onBackToOriginal, t }: Props) {
  const [compare, setCompare] = useState(false);
  const [reporting, setReporting] = useState<number | null>(null);
  const lang = languages.find((l) => l.code === targetLanguage);
  const dir = lang?.direction ?? "ltr";

  return (
    <section aria-label={t.reader.translationPanel} className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {t.reader.translatedPage} {pageNumber}
            {lang && <span className="ml-1 font-normal text-slate-500">· {lang.name}</span>}
          </p>
          {state.status === "ready" && !state.data.sameLanguage && (
            <p className="text-xs text-slate-500">
              {state.data.cacheHits} {t.reader.fromCache} · {state.data.providerSegments} {t.reader.fromProvider}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            aria-pressed={compare}
            title={compare ? t.reader.hideCompare : t.reader.compare}
            className={cx("rounded-md p-2 text-slate-600 hover:bg-slate-100", compare && "bg-brand-50 text-brand-700")}
          >
            <Columns2 className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{compare ? t.reader.hideCompare : t.reader.compare}</span>
          </button>
          <button type="button" onClick={onClose} title={t.reader.closePanel} className="rounded-md p-2 text-slate-600 hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t.reader.closePanel}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {state.status === "idle" && <p className="text-sm text-slate-500">{t.reader.chooseLanguage}</p>}

        {state.status === "loading" && (
          <div className="space-y-3" aria-busy="true">
            <Spinner label={`${t.reader.extracting} ${t.reader.checkingCache} ${t.reader.translating}`} />
            <div className="space-y-2" aria-hidden="true">
              <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-9/12 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="space-y-3">
            <Alert tone={state.code === "no_text" || state.code === "not_configured" ? "warning" : "danger"} title={errorTitle(state.code, t)}>
              <p>{state.message}</p>
              {state.retryAfterSeconds ? <p className="mt-1 text-xs">Retry-After : {state.retryAfterSeconds}s</p> : null}
            </Alert>
            <div className="flex gap-2">
              {state.code !== "no_text" && state.code !== "not_configured" && state.code !== "forbidden" && (
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.common.retry}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onBackToOriginal}>
                {t.reader.showOriginal}
              </Button>
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <div className="space-y-4">
            {state.data.sameLanguage && <Alert tone="info">{t.reader.sameLanguage}</Alert>}
            {state.data.truncated && (
              <Alert tone="warning">
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t.reader.truncated}
                </span>
              </Alert>
            )}
            {state.data.ocrUsed && <Alert tone="info">OCR</Alert>}
            <ol className="space-y-4">
              {state.data.segments.map((seg) => (
                <li key={seg.index} className="group">
                  {compare && (
                    <p className="mb-1 rounded bg-slate-50 px-2 py-1.5 text-sm leading-relaxed text-slate-600" lang={sourceLanguage}>
                      {seg.source}
                    </p>
                  )}
                  {seg.translated === null ? (
                    <p className="text-sm italic text-slate-400">—</p>
                  ) : (
                    <p className="text-[15px] leading-relaxed text-slate-900" dir={dir} lang={targetLanguage ?? undefined}>
                      {seg.translated}
                    </p>
                  )}
                  {!state.data.sameLanguage && seg.translated !== null && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>{seg.fromCache ? t.reader.fromCache : t.reader.fromProvider}</span>
                      <button
                        type="button"
                        onClick={() => setReporting(reporting === seg.index ? null : seg.index)}
                        className="inline-flex items-center gap-1 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                      >
                        <Flag className="h-3 w-3" aria-hidden="true" />
                        {t.reader.report}
                      </button>
                    </div>
                  )}
                  {reporting === seg.index && targetLanguage && (
                    <ReportForm
                      documentId={documentId}
                      pageNumber={pageNumber}
                      segmentIndex={seg.index}
                      targetLanguage={targetLanguage}
                      onDone={() => setReporting(null)}
                      t={t}
                    />
                  )}
                </li>
              ))}
            </ol>
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">{t.common.disclaimer}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function errorTitle(code: string, t: ReaderDictionary) {
  switch (code) {
    case "no_text":
      return t.reader.noText;
    case "rate_limited":
      return "429";
    case "forbidden":
    case "unauthorized":
      return t.reader.accessDenied;
    default:
      return t.common.error;
  }
}

function ReportForm({
  documentId,
  pageNumber,
  segmentIndex,
  targetLanguage,
  onDone,
  t,
}: {
  documentId: string;
  pageNumber: number;
  segmentIndex: number;
  targetLanguage: string;
  onDone: () => void;
  t: ReaderDictionary;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function submit() {
    setStatus("sending");
    const res = await fetch("/api/translation-reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId, pageNumber, segmentIndex, targetLanguage, description: text }),
    });
    setStatus(res.ok ? "sent" : "error");
    if (res.ok) setTimeout(onDone, 1500);
  }
  if (status === "sent") return <p className="mt-2 text-xs text-emerald-700">{t.reader.reportSent}</p>;
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <label htmlFor={`report-${segmentIndex}`} className="sr-only">
        {t.reader.report}
      </label>
      <Textarea id={`report-${segmentIndex}`} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.reader.reportPlaceholder} className="text-xs" />
      {status === "error" && <p className="mt-1 text-xs text-red-600">{t.common.error}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={submit} disabled={text.trim().length < 5 || status === "sending"}>
          {t.reader.report}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
