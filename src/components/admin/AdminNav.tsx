"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, cx } from "@/components/ui";

export function AdminNav({ items, title, role }: { items: { href: string; label: string; exact?: boolean }[]; title: string; role: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={title} className="lg:sticky lg:top-20 lg:self-start">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <Badge tone={role === "admin" ? "accent" : "brand"}>{role}</Badge>
      </div>
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
        {items.map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cx("block rounded-md px-3 py-2 text-sm font-medium", active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100")}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
