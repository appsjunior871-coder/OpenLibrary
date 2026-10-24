import Link from "next/link";

export function Logo({ withTagline = false, className = "" }: { withTagline?: boolean; className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`} aria-label="OpenLibrary — accueil">
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="24" cy="24" r="22" stroke="url(#ol-ring)" strokeWidth="3" />
        <path d="M12 32c4-2 8-2 12 0 4-2 8-2 12 0V14c-4-2-8-2-12 0-4-2-8-2-12 0v18z" fill="white" stroke="#1a6a90" strokeWidth="1.5" />
        <path d="M24 14v18" stroke="#1a6a90" strokeWidth="1.5" />
        <path d="M15 11l3 5M21 9l1 6M27 9l-1 6M33 11l-3 5" stroke="#ec8a2a" strokeWidth="2.2" strokeLinecap="round" />
        <defs>
          <linearGradient id="ol-ring" x1="2" y1="2" x2="46" y2="46">
            <stop stopColor="#46a1c8" />
            <stop offset="1" stopColor="#ec8a2a" />
          </linearGradient>
        </defs>
      </svg>
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-tight text-brand-800">
          Open<span className="text-brand-600">Library</span>
        </span>
        {withTagline && <span className="block text-xs text-slate-500">L&apos;accès libre à la connaissance</span>}
      </span>
    </Link>
  );
}
