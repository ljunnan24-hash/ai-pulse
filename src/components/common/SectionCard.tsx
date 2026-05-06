import type { ReactNode } from 'react';

type Props = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  /** 详情页：更大字号与行高，眉标不使用全大写 */
  detail?: boolean;
};

export function SectionCard({ title, eyebrow, children, className = '', detail = false }: Props) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${detail ? 'p-6 md:p-7' : 'p-5 md:p-6'} ${className}`}
    >
      {eyebrow ? (
        <p
          className={`mb-2 font-semibold text-slate-500 ${detail ? 'text-xs tracking-normal' : 'text-[0.7rem] uppercase tracking-wider'}`}
        >
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h3 className={`font-headline font-bold text-slate-900 ${detail ? 'text-xl md:text-[1.35rem]' : 'text-lg'}`}>{title}</h3>
      ) : null}
      <div className={title || eyebrow ? (detail ? 'mt-4' : 'mt-3') : ''}>{children}</div>
    </div>
  );
}
