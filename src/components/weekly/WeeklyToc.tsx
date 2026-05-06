import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export type TocItem = {
  id: string;
  label: string;
  hint?: string;
  /** 如 "~5 分钟" */
  minutes?: string;
};

type Props = {
  items: TocItem[];
};

export function WeeklyToc({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="本期目录" className="card-surface border-slate-200/90 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <p className="font-headline text-xs font-semibold uppercase tracking-wide text-slate-500">本期目录</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((it, idx) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="group flex gap-2 py-2.5 text-sm transition-colors first:pt-0 last:pb-0"
            >
              <span className="w-6 shrink-0 pt-0.5 text-right text-[0.65rem] font-medium tabular-nums text-slate-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-snug text-slate-800 group-hover:text-primary">{it.label}</span>
                  {it.minutes ? (
                    <span className="shrink-0 text-[0.65rem] tabular-nums text-slate-400">{it.minutes}</span>
                  ) : null}
                </div>
                {it.hint ? <p className="mt-0.5 text-[0.7rem] leading-snug text-slate-500">{it.hint}</p> : null}
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-primary" aria-hidden />
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-[0.65rem] font-medium text-slate-500">邮件订阅</p>
        <Link
          to="/#subscribe"
          className="btn-secondary mt-2 inline-flex w-full justify-center py-2 text-xs font-semibold no-underline md:text-sm"
        >
          订阅周报
        </Link>
      </div>
    </nav>
  );
}
