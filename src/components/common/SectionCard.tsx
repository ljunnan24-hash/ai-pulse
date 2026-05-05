import type { ReactNode } from 'react';

type Props = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, eyebrow, children, className = '' }: Props) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-6 ${className}`}
    >
      {eyebrow ? (
        <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500">{eyebrow}</p>
      ) : null}
      {title ? <h3 className="font-headline text-lg font-bold text-slate-900">{title}</h3> : null}
      <div className={title || eyebrow ? 'mt-3' : ''}>{children}</div>
    </div>
  );
}
