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
        {eyebrow ? (
          <p className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-sm">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-slate-950 md:text-[30px]">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type AdminTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

export function AdminStatCard({
  label,
  value,
  hint,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: AdminTone;
}) {
  const toneCls = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-500',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${toneCls}`}>{icon}</span> : null}
      </div>
      <div className="mt-2 break-words font-headline text-[26px] font-extrabold leading-8 tracking-tight text-slate-950 tabular-nums">{value}</div>
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
    <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {title || description || actions ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
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
    primary: 'border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:outline-blue-600',
    secondary: 'border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-400',
    danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 focus-visible:outline-rose-500',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400',
  }[variant];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

export function AdminError({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm">
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
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-bold ring-1 ${map.cls}`}>
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
