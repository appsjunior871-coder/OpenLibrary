"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Scaling,
  FileText,
  Languages,
} from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { Alert, Button, ButtonLink, Spinner, cx } from "@/components/ui";
import { LanguageMenu } from "./LanguageMenu";
import { TranslationPanel } from "./TranslationPanel";
import { SummaryPanel } from "./SummaryPanel";
import { readApiError, type OpenResponse, type ReaderDictionary, type TranslationState } from "./types";
import type { TranslatePageResult } from "@/lib/services/translation";

type Props = {
  documentId: string;
  initialPage: number | null;
  initialLang: string | null;
  preferredLanguage: string | null;
  summaryLanguage: string | null;
  layout: "side" | "below";
  uiLocale: string;
  t: ReaderDictionary;
};

type OpenState =
  | { status: "opening" }
  | { status: "ready"; data: OpenResponse }
  | { status: "error"; code: string; message: string };

type PanelMode = "none" | "translation" | "summary";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function PdfReader({ documentId, initialPage, initialLang, preferredLanguage, summaryLanguage, layout, t }: Props) {
  // --- Open the document (session + access check, server side) --------------
  const [open, setOpen] = useState<OpenState>({ status: "opening" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/open`, { method: "POST" });
        if (!res.ok) {
          const err = await readApiError(res);
          if (!cancelled) setOpen({ status: "error", ...err });
          return;
        }
        const data = (await res.json()) as OpenResponse;
        if (!cancelled) setOpen({ status: "ready", data });
      } catch {
        if (!cancelled) setOpen({ status: "error", code: "network", message: t.common.error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, t.common.error]);

  if (open.status === "opening") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <Spinner label={t.reader.loadingPdf} />
      </div>
    );
  }
  if (open.status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4">
        <Alert tone="danger" title={open.code === "forbidden" || open.code === "unauthorized" ? t.reader.accessDenied : t.common.error} className="max-w-md">
          {open.message}
        </Alert>
        <ButtonLink href="/catalog" variant="secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t.common.back}
        </ButtonLink>
      </div>
    );
  }
  return (
    <ReaderShell
      data={open.data}
      initialPage={initialPage ?? open.data.resume?.lastPage ?? 1}
      initialLang={initialLang ?? open.data.resume?.lastTargetLanguage ?? null}
      preferredLanguage={preferredLanguage}
      summaryLanguage={summaryLanguage}
      layout={layout}
      t={t}
    />
  );
}

// ---------------------------------------------------------------------------
// Reader shell: pdf.js rendering + toolbar + panels
// ---------------------------------------------------------------------------
function ReaderShell({
  data,
  initialPage,
  initialLang,
  preferredLanguage,
  summaryLanguage,
  layout,
  t,
}: {
  data: OpenResponse;
  initialPage: number;
  initialLang: string | null;
  preferredLanguage: string | null;
  summaryLanguage: string | null;
  layout: "side" | "below";
  t: ReaderDictionary;
}) {
  const { document: doc, fileUrl, languages, canDownload } = data;
  const pageCount = doc.pageCount;

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [page, setPage] = useState(() => Math.min(Math.max(1, initialPage), Math.max(1, pageCount)));
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [rendering, setRendering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panel, setPanel] = useState<PanelMode>(initialLang ? "translation" : "none");
  const [mobileView, setMobileView] = useState<"pdf" | "panel">("pdf");
  const [targetLang, setTargetLang] = useState<string | null>(initialLang && initialLang !== doc.sourceLanguage ? initialLang : null);
  const [translation, setTranslation] = useState<TranslationState>({ status: "idle" });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ page: number; count: number }[] | null>(null);
  const [searching, setSearching] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<void> } | null>(null);
  const renderSeqRef = useRef(0);
  const translationCache = useRef(new Map<string, TranslatePageResult>());
  const abortRef = useRef<AbortController | null>(null);
  const textIndexRef = useRef<Map<number, string> | null>(null);

  // --- Load the PDF with pdf.js (client side, lazy range requests) ----------
  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Worker served from /public (copied by scripts/copy-pdf-worker.mjs on install/dev/build).
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url: fileUrl, withCredentials: true });
        loadingTask = task;
        task.onProgress = (p: { loaded: number; total: number }) => {
          if (p.total) setLoadProgress(Math.round((p.loaded / p.total) * 100));
        };
        const loaded = await task.promise;
        if (cancelled) {
          await task.destroy();
          return;
        }
        setPdf(loaded);
      } catch (err) {
        console.error("[reader] pdf load failed", err);
        if (!cancelled) setPdfError(t.reader.pdfError);
      }
    })();
    return () => {
      cancelled = true;
      loadingTask?.destroy().catch(() => undefined);
    };
  }, [fileUrl, t.reader.pdfError]);

  // --- Render the current page ---------------------------------------------
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current || !viewerRef.current) return;
    // Serialise renders: pdf.js forbids two concurrent render() calls on one canvas.
    const seq = ++renderSeqRef.current;
    const previous = renderTaskRef.current;
    if (previous) {
      previous.cancel();
      await previous.promise.catch(() => undefined);
      if (renderTaskRef.current === previous) renderTaskRef.current = null;
    }
    if (seq !== renderSeqRef.current) return; // superseded while waiting
    setRendering(true);
    try {
      const pdfPage = await pdf.getPage(page);
      if (seq !== renderSeqRef.current || !canvasRef.current || !viewerRef.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const available = viewerRef.current.clientWidth - 32;
      const scale = zoom === "fit" ? Math.max(0.3, available / base.width) : zoom;
      const viewport = pdfPage.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const task = pdfPage.render({ canvasContext: ctx, viewport, canvas });
      renderTaskRef.current = task;
      await task.promise;
      if (renderTaskRef.current === task) renderTaskRef.current = null;
    } catch (err) {
      if ((err as { name?: string })?.name !== "RenderingCancelledException") console.error("[reader] render failed", err);
    } finally {
      if (seq === renderSeqRef.current) setRendering(false);
    }
  }, [pdf, page, zoom]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  useEffect(() => {
    if (zoom !== "fit") return;
    const el = viewerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => renderPage());
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom, renderPage]);

  // --- Translation (on demand, per page) ------------------------------------
  const requestTranslation = useCallback(
    async (lang: string, pageNumber: number, force = false) => {
      const key = `${pageNumber}:${lang}`;
      abortRef.current?.abort();
      if (!force) {
        const cached = translationCache.current.get(key);
        if (cached) {
          setTranslation({ status: "ready", data: cached });
          return;
        }
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setTranslation({ status: "loading" });
      try {
        const res = await fetch("/api/translations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId: doc.id, pageNumber, targetLanguage: lang }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const err = await readApiError(res);
          setTranslation({ status: "error", ...err });
          return;
        }
        const result = (await res.json()) as TranslatePageResult;
        translationCache.current.set(key, result);
        setTranslation({ status: "ready", data: result });
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setTranslation({ status: "error", code: "network", message: t.common.error });
      }
    },
    [doc.id, t.common.error],
  );

  useEffect(() => {
    if (targetLang) requestTranslation(targetLang, page);
  }, [targetLang, page, requestTranslation]);

  function selectLanguage(code: string | null) {
    if (code === null) {
      abortRef.current?.abort();
      setTargetLang(null);
      setTranslation({ status: "idle" });
      setPanel("none");
      setMobileView("pdf");
      return;
    }
    setTargetLang(code);
    setPanel("translation");
    setMobileView("panel");
  }

  // --- Persist reading position (debounced) ---------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/me/history/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lastPage: page, lastTargetLanguage: targetLang }),
        keepalive: true,
      }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [doc.id, page, targetLang]);

  // --- Keyboard navigation --------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") setPage((p) => Math.min(pageCount, p + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageCount]);

  // --- Fullscreen -----------------------------------------------------------
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen() {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.().catch(() => undefined);
    else document.exitFullscreen?.().catch(() => undefined);
  }

  // --- Text search (client side, via pdf.js text layer) ---------------------
  async function runSearch() {
    if (!pdf || !searchTerm.trim()) return;
    setSearching(true);
    try {
      if (!textIndexRef.current) {
        const index = new Map<number, string>();
        for (let p = 1; p <= pdf.numPages; p++) {
          const pg = await pdf.getPage(p);
          const content = await pg.getTextContent();
          index.set(p, content.items.map((i) => ("str" in i ? i.str : "")).join(" "));
        }
        textIndexRef.current = index;
      }
      const needle = searchTerm.trim().toLowerCase();
      const results: { page: number; count: number }[] = [];
      for (const [p, text] of textIndexRef.current) {
        const count = text.toLowerCase().split(needle).length - 1;
        if (count > 0) results.push({ page: p, count });
      }
      setSearchResults(results);
      if (results.length) setPage(results[0].page);
    } finally {
      setSearching(false);
    }
  }

  const zoomLabel = zoom === "fit" ? "Auto" : `${Math.round(zoom * 100)}%`;
  const zoomIn = () => setZoom((z) => (z === "fit" ? 1.25 : (ZOOM_STEPS.find((s) => s > z) ?? z)));
  const zoomOut = () => setZoom((z) => (z === "fit" ? 0.75 : ([...ZOOM_STEPS].reverse().find((s) => s < z) ?? z)));

  const panelVisible = panel !== "none";
  const sideLayout = layout === "side";
  const defaultSummaryLang = useMemo(() => {
    const candidates = [summaryLanguage, targetLang, preferredLanguage, doc.sourceLanguage, "fr"];
    return candidates.find((c) => c && languages.some((l) => l.code === c && l.supportsSummary)) ?? languages.find((l) => l.supportsSummary)?.code ?? "fr";
  }, [summaryLanguage, targetLang, preferredLanguage, doc.sourceLanguage, languages]);

  return (
    <div ref={rootRef} className="flex h-screen flex-col bg-slate-100">
      {/* Toolbar */}
      <header className="z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex h-12 items-center gap-2 overflow-x-auto px-2 [scrollbar-width:thin] sm:px-3">
          <Link href={`/documents/${doc.id}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100" title={t.common.back}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t.common.back}</span>
          </Link>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-semibold text-slate-900" title={doc.title}>
              {doc.title}
            </p>
            <p className="truncate text-xs text-slate-500">
              {doc.author} · {t.common.sourceLanguage} {doc.sourceLanguage.toUpperCase()}
            </p>
          </div>

          <div className="mx-auto flex shrink-0 items-center gap-1">
            <ToolbarButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} label={t.reader.prevPage}>
              <ChevronLeft className="h-4 w-4" />
            </ToolbarButton>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number((new FormData(e.currentTarget).get("page") as string) ?? "");
                if (v >= 1 && v <= pageCount) setPage(v);
              }}
              className="flex items-center gap-1 whitespace-nowrap text-sm"
            >
              <label htmlFor="page-input" className="sr-only">
                {t.reader.goToPage}
              </label>
              <input
                id="page-input"
                name="page"
                key={page}
                type="number"
                min={1}
                max={pageCount}
                defaultValue={page}
                className="h-8 w-14 rounded-md border border-slate-300 px-1 text-center text-sm"
              />
              <span className="text-slate-500">/ {pageCount}</span>
            </form>
            <ToolbarButton onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} label={t.reader.nextPage}>
              <ChevronRight className="h-4 w-4" />
            </ToolbarButton>
            <span className="mx-1 hidden h-6 w-px bg-slate-200 md:block" aria-hidden="true" />
            <ToolbarButton onClick={zoomOut} label={t.reader.zoomOut} className="hidden md:inline-flex">
              <ZoomOut className="h-4 w-4" />
            </ToolbarButton>
            <span className="hidden w-12 text-center text-xs text-slate-600 md:inline" aria-live="polite">
              {zoomLabel}
            </span>
            <ToolbarButton onClick={zoomIn} label={t.reader.zoomIn} className="hidden md:inline-flex">
              <ZoomIn className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => setZoom("fit")} label={t.reader.fitWidth} active={zoom === "fit"} className="hidden md:inline-flex">
              <Scaling className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => setSearchOpen((v) => !v)} label={t.reader.search} active={searchOpen}>
              <Search className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <LanguageMenu languages={languages} sourceLanguage={doc.sourceLanguage} current={targetLang} preferred={preferredLanguage} onSelect={selectLanguage} t={t} />
            <button
              type="button"
              onClick={() => {
                setPanel(panel === "summary" ? (targetLang ? "translation" : "none") : "summary");
                setMobileView("panel");
              }}
              aria-pressed={panel === "summary"}
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium",
                panel === "summary" ? "border-accent-500 bg-accent-500/10 text-accent-600" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">{t.reader.summarize}</span>
            </button>
            {canDownload && (
              <a href={`${fileUrl}?download=1`} className="hidden h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 sm:inline-flex" title={t.common.download}>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t.common.download}</span>
              </a>
            )}
            <ToolbarButton onClick={toggleFullscreen} label={fullscreen ? t.reader.exitFullscreen : t.reader.fullscreen} className="hidden sm:inline-flex">
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </ToolbarButton>
          </div>
        </div>

        {searchOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
            className="flex items-center gap-2 border-t border-slate-100 px-3 py-2"
            role="search"
          >
            <label htmlFor="pdf-search" className="sr-only">
              {t.reader.search}
            </label>
            <input
              id="pdf-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.reader.search}
              className="h-8 flex-1 rounded-md border border-slate-300 px-2 text-sm"
            />
            <Button size="sm" type="submit" variant="secondary" disabled={searching || !searchTerm.trim()}>
              {searching ? "…" : t.common.search}
            </Button>
            {searchResults && (
              <div className="flex max-w-[50%] items-center gap-1 overflow-x-auto text-xs text-slate-600">
                {searchResults.length === 0 ? (
                  <span>{t.reader.searchNoResult}</span>
                ) : (
                  searchResults.map((r) => (
                    <button key={r.page} type="button" onClick={() => setPage(r.page)} className={cx("rounded px-1.5 py-0.5 hover:bg-slate-100", r.page === page && "bg-brand-50 text-brand-700")}>
                      p.{r.page} ({r.count})
                    </button>
                  ))
                )}
              </div>
            )}
          </form>
        )}

        {/* Mobile tabs when a panel is open */}
        {panelVisible && (
          <div className="flex border-t border-slate-100 lg:hidden" role="tablist">
            <button role="tab" aria-selected={mobileView === "pdf"} onClick={() => setMobileView("pdf")} className={cx("flex-1 py-2 text-sm font-medium", mobileView === "pdf" ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-600")}>
              <FileText className="mr-1 inline h-4 w-4" aria-hidden="true" /> PDF
            </button>
            <button role="tab" aria-selected={mobileView === "panel"} onClick={() => setMobileView("panel")} className={cx("flex-1 py-2 text-sm font-medium", mobileView === "panel" ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-600")}>
              {panel === "summary" ? <Sparkles className="mr-1 inline h-4 w-4" aria-hidden="true" /> : <Languages className="mr-1 inline h-4 w-4" aria-hidden="true" />}
              {panel === "summary" ? t.reader.summaryTitle : t.reader.translatedPage}
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <div className={cx("flex min-h-0 flex-1", sideLayout ? "flex-col lg:flex-row" : "flex-col")}>
        <div
          ref={viewerRef}
          className={cx("relative min-h-0 flex-1 overflow-auto p-4", panelVisible && mobileView === "panel" && "hidden lg:block", !sideLayout && panelVisible && "lg:max-h-[55%]")}
        >
          {pdfError ? (
            <div className="mx-auto max-w-md pt-10">
              <Alert tone="danger">{pdfError}</Alert>
            </div>
          ) : !pdf ? (
            <div className="flex h-full items-center justify-center">
              <div className="w-64 text-center">
                <Spinner label={t.reader.loadingPdf} />
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={loadProgress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${loadProgress}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="relative">
                <canvas ref={canvasRef} className="pdf-canvas" role="img" aria-label={`${t.common.page} ${page}`} />
                {rendering && (
                  <div className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">
                    <Spinner label={t.reader.rendering} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {panelVisible && (
          <aside
            className={cx(
              "min-h-0 border-slate-200 bg-white",
              sideLayout ? "flex-1 lg:w-[440px] lg:flex-none lg:border-l" : "flex-1 lg:border-t",
              mobileView === "pdf" && "hidden lg:block",
            )}
          >
            {panel === "translation" ? (
              <TranslationPanel
                state={translation}
                targetLanguage={targetLang}
                languages={languages}
                sourceLanguage={doc.sourceLanguage}
                pageNumber={page}
                documentId={doc.id}
                onRetry={() => targetLang && requestTranslation(targetLang, page, true)}
                onClose={() => {
                  setPanel("none");
                  setMobileView("pdf");
                }}
                onBackToOriginal={() => selectLanguage(null)}
                t={t}
              />
            ) : (
              <SummaryPanel
                documentId={doc.id}
                pageCount={pageCount}
                currentPage={page}
                languages={languages}
                defaultLanguage={defaultSummaryLang}
                onClose={() => {
                  setPanel(targetLang ? "translation" : "none");
                  if (!targetLang) setMobileView("pdf");
                }}
                t={t}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  active,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-pressed={active}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-brand-50 text-brand-700",
        className,
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
