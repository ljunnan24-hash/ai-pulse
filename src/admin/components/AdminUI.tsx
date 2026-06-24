import type { ReactNode } from 'react';
import { AlertCircle, ArrowUpRight, Loader2 } from 'lucide-react';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p> : null}
        <h1 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-slate-950 md:text-[30px]">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <div className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-slate-950 tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {title || description || actions ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="font-headline text-base font-bold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminButton({
  children,
  variant = 'secondary',
  disabled,
  onClick,
  type = 'button',
  title,
  className = '',
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  title?: string;
  className?: string;
}) {
  const cls = {
    primary: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
    danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminError({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function AdminEmpty({ children = '暂无数据。' }: { children?: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function AdminStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let map = { label: status || 'Unknown', cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };
  if (normalized === 'active' || normalized === 'ok') {
    map = { label: normalized === 'ok' ? 'OK' : 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' };
  } else if (normalized === 'pending') {
    map = { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' };
  } else if (normalized === 'warning' || normalized === 'empty_feed' || normalized === 'all_filtered') {
    map = { label: status || 'Warning', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' };
  } else if (normalized === 'failing' || normalized === 'fetch_failed' || normalized === 'invalid_feed' || normalized === 'parse_failed') {
    map = { label: status || 'Failing', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' };
  } else if (normalized === 'no_data') {
    map = { label: 'No data', cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };
  } else if (normalized === 'reviewed') {
    map = { label: 'Reviewed', cls: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' };
  } else if (normalized === 'archived' || normalized === 'unsubscribed') {
    map = { label: normalized === 'archived' ? 'Archived' : 'Unsubscribed', cls: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' };
  }
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 ${map.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </span>
  );
}

export function AdminLoadingLabel({ children = '加载中…' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {children}
    </span>
  );
}

export function ExternalAdminLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}
