import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300",
  secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  accent: "bg-accent-500 text-white hover:bg-accent-600 disabled:bg-accent-400/60",
};
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap",
    variantClasses[variant],
    sizeClasses[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link href={href} className={buttonClasses(variant, size, className)} {...props} />;
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={cx(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cx(
        "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-brand-500 disabled:bg-slate-100",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-800",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-800",
  accent: "bg-orange-50 text-orange-800",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function Alert({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-slate-200 bg-slate-50 text-slate-800",
    info: "border-brand-200 bg-brand-50 text-brand-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div role={tone === "danger" || tone === "warning" ? "alert" : "status"} className={cx("rounded-md border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {body && <p className="mt-1 text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-sm text-slate-600", className)} role="status" aria-live="polite">
      <svg className="h-4 w-4 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label && <span>{label}</span>}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600 sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function formatDate(d: Date | string | null | undefined, locale = "fr-FR") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined, locale = "fr-FR") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}
