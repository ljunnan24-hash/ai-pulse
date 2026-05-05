import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  /** 标题右侧或下方额外元素 */
  extra?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, subtitle, extra, className = '' }: Props) {
  return (
    <div className={`mb-6 md:mb-8 ${className}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-headline text-2xl font-bold tracking-tight text-slate-900 md:text-[1.65rem]">{title}</h2>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p> : null}
        </div>
        {extra ? <div className="shrink-0">{extra}</div> : null}
      </div>
    </div>
  );
}
