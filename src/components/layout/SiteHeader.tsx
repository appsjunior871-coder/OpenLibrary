import { getCurrentUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/authz/permissions";
import { getT } from "@/lib/i18n/server";
import { Logo } from "./Logo";
import { HeaderNav } from "./HeaderNav";

export async function SiteHeader() {
  const [user, { t, locale }] = await Promise.all([getCurrentUser(), getT()]);
  const links = [
    { href: "/", label: t.nav.home },
    { href: "/catalog", label: t.nav.catalog },
    ...(user ? [{ href: "/dashboard", label: t.nav.dashboard }, { href: "/dashboard/requests", label: t.nav.requests }] : []),
    ...(user && isStaff(user.role) ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 rounded bg-brand-700 px-3 py-2 text-sm text-white">
        {t.nav.skipToContent}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <HeaderNav
          links={links}
          user={user ? { displayName: user.displayName } : null}
          locale={locale}
          labels={{
            login: t.nav.login,
            register: t.nav.register,
            logout: t.nav.logout,
            settings: t.nav.settings,
            openMenu: t.nav.openMenu,
            closeMenu: t.nav.closeMenu,
          }}
        />
      </div>
    </header>
  );
}
