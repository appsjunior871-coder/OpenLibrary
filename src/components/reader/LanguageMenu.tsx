"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { cx } from "@/components/ui";
import type { ReaderLanguage, ReaderDictionary } from "./types";

type Props = {
  languages: ReaderLanguage[];
  sourceLanguage: string;
  current: string | null; // null = original
  preferred?: string | null;
  onSelect: (code: string | null) => void;
  t: ReaderDictionary;
};

/**
 * "🌐 Lire dans une autre langue" — shown INSIDE the reader, after the document is open.
 * Only active languages (provided by the server) are listed.
 */
export function LanguageMenu({ languages, sourceLanguage, current, preferred, onSelect, t }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sorted = [...languages].sort((a, b) => {
    if (a.code === preferred) return -1;
    if (b.code === preferred) return 1;
    return 0;
  });
  const currentLang = current ? languages.find((l) => l.code === current) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={currentLang ? `${t.reader.translate} — ${currentLang.name}` : t.reader.translate}
        title={t.reader.translate}
        className={cx(
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
          current ? "bg-accent-500 text-white hover:bg-accent-600" : "bg-brand-600 text-white hover:bg-brand-700",
        )}
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{currentLang ? currentLang.name : t.reader.translate}</span>
        <span className="sm:hidden">{currentLang ? currentLang.code.toUpperCase() : "🌐"}</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t.reader.chooseLanguage}
          className="absolute right-0 z-40 mt-1 w-64 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl"
        >
          <li className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.reader.chooseLanguage}</li>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={current === null}
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className={cx("flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50", current === null && "bg-brand-50")}
            >
              <span>
                {t.reader.original}
                <span className="ml-1 text-xs text-slate-500">({sourceLanguage.toUpperCase()})</span>
              </span>
              {current === null && <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />}
            </button>
          </li>
          <li className="my-1 border-t border-slate-100" role="separator" />
          {sorted.map((l) => {
            const selected = current === l.code;
            const isSource = l.code === sourceLanguage;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={isSource}
                  onClick={() => {
                    onSelect(l.code);
                    setOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                    selected && "bg-brand-50",
                  )}
                >
                  <span>
                    <span className="font-medium">{l.name}</span>
                    <span className="ml-2 text-xs text-slate-500" dir={l.direction}>
                      {l.nativeName}
                    </span>
                    {l.code === preferred && <span className="ml-2 text-[10px] uppercase text-accent-600">★</span>}
                  </span>
                  {selected && <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
