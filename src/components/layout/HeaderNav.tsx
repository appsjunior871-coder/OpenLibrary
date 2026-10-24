"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut, Settings, UserCircle2 } from "lucide-react";
import { buttonClasses, cx } from "@/components/ui";

type Props = {
  links: { href: string; label: string }[];
  user: { displayName: string } | null;
  locale: string;
  labels: { login: string; register: string; logout: string; settings: string; openMenu: string; closeMenu: string };
};

export function HeaderNav({ links, user, locale, labels }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  async function switchLocale(next: string) {
    document.cookie = `ol_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    if (user) {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferences: { uiLocale: next } }),
      });
    }
    router.refresh();
  }

  const navLinks = (
    <>
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-100",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );

  const localeSwitch = (
    <div className="flex items-center rounded-md border border-slate-200 text-xs" role="group" aria-label="Interface language">
      {["fr", "en"].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchLocale(l)}
          aria-pressed={locale === l}
          className={cx("px-2 py-1 uppercase", locale === l ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")}
        >
          {l}
        </button>
      ))}
    </div>
  );

  const authActions = user ? (
    <div className="flex items-center gap-2">
      <Link href="/dashboard/settings" className={buttonClasses("ghost", "sm")} onClick={() => setOpen(false)} title={labels.settings}>
        <Settings className="h-4 w-4" aria-hidden="true" />
        <span className="max-w-[10rem] truncate">{user.displayName}</span>
      </Link>
      <button type="button" onClick={logout} className={buttonClasses("secondary", "sm")}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {labels.logout}
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link href="/login" className={buttonClasses("ghost", "sm")} onClick={() => setOpen(false)}>
        <UserCircle2 className="h-4 w-4" aria-hidden="true" />
        {labels.login}
      </Link>
      <Link href="/register" className={buttonClasses("primary", "sm")} onClick={() => setOpen(false)}>
        {labels.register}
      </Link>
    </div>
  );

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
        {navLinks}
      </nav>
      <div className="hidden items-center gap-3 md:flex">
        {localeSwitch}
        {authActions}
      </div>
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? labels.closeMenu : labels.openMenu}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div id="mobile-nav" className="absolute inset-x-0 top-16 border-b border-slate-200 bg-white p-4 shadow-lg md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {navLinks}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4">
            {localeSwitch}
            {authActions}
          </div>
        </div>
      )}
    </>
  );
}
