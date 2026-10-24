import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const [{ t }, user] = await Promise.all([getT(), getCurrentUser()]);
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <Logo withTagline />
          <p className="mt-3 max-w-sm text-sm text-slate-600">{t.common.disclaimer}</p>
        </div>
        <nav aria-label="Pied de page" className="text-sm">
          <p className="font-semibold text-slate-800">{t.nav.catalog}</p>
          <ul className="mt-2 space-y-1 text-slate-600">
            <li>
              <Link href="/catalog" className="hover:text-brand-700">
                {t.catalog.title}
              </Link>
            </li>
            {user ? (
              <li>
                <Link href="/dashboard" className="hover:text-brand-700">
                  {t.nav.dashboard}
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link href="/register" className="hover:text-brand-700">
                    {t.nav.register}
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-brand-700">
                    {t.nav.login}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-800">{t.home.limitsTitle}</p>
          <p className="mt-2">{t.home.limitsBody}</p>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} OpenLibrary</div>
    </footer>
  );
}
