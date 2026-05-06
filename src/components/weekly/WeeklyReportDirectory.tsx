import { ChevronRight, FileText } from 'lucide-react';

import type { TocItem } from './WeeklyToc';

type Props = {
  items: TocItem[];
};

/**
 * 目标稿「本周报告目录」：单行锚点，图标 + 序号 + 标题 + 摘要 + 阅读时长 + 箭头
 */
export function WeeklyReportDirectory({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section id="weekly-report-directory" className="scroll-mt-28 mt-10 md:mt-12">
      <h2 className="font-headline text-lg font-bold tracking-tight text-slate-900 md:text-xl">本周报告目录</h2>
      <nav aria-label="本周报告目录" className="card-surface mt-4 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {items.map((it, idx) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 md:gap-4 md:px-5 md:py-4"
              >
                <FileText
                  className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-primary"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="w-9 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-slate-400">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-headline text-sm font-semibold text-slate-900 group-hover:text-primary md:text-[0.95rem]">
                      {it.label}
                    </span>
                    {it.minutes ? (
                      <span className="shrink-0 text-[0.7rem] tabular-nums text-slate-400">
                        {it.minutes.startsWith('约') ? it.minutes : `约 ${it.minutes.replace(/^~/, '').trim()} 分钟`}
                      </span>
                    ) : null}
                  </div>
                  {it.hint ? (
                    <p className="mt-1 text-[0.8125rem] leading-snug text-slate-500">{it.hint}</p>
                  ) : null}
                </div>
                <ChevronRight
                  className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
