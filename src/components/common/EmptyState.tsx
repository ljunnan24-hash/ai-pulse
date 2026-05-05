import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  children?: ReactNode;
};

export function EmptyState({ title, description, actionLabel, actionTo, children }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
      <p className="font-headline text-lg font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
      {children}
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          className="mt-6 inline-flex rounded-full bg-[#005bc1] px-6 py-2.5 font-headline text-sm font-bold text-white shadow-sm"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
