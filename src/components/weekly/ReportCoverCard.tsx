import { Link } from 'react-router-dom';

import type { ThesisShape } from './WeeklyThesisCard';

type Props = {
  thesis: ThesisShape;
  readingMinutes: number;
  /** Top3 判断条数 */
  topJudgmentCount: number;
  /** 噪音过滤条数 */
  noiseFilteredCount: number;
};

export function ReportCoverCard({ thesis, readingMinutes, topJudgmentCount, noiseFilteredCount }: Props) {
  const lines = Array.isArray(thesis.trend_lines) ? thesis.trend_lines.filter(Boolean) : [];

  return (
    <section id="weekly-thesis" className="mb-8 scroll-mt-28 md:mb-10">
      <div className="card-surface-muted relative overflow-hidden p-5 md:p-7">
        <div
          className="pointer-events-none absolute -right-8 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-primary/[0.04]"
          aria-hidden
        />

        <div className="relative">
          <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
            本周核心判断
          </span>

          {thesis.headline ? (
            <p className="mt-4 font-headline text-xl font-bold leading-snug text-slate-900 md:text-2xl md:leading-tight">
              {thesis.headline}
            </p>
          ) : null}

          {thesis.summary ? (
            <p className="relative mt-4 text-sm leading-[1.75] text-slate-700 md:text-[0.95rem] md:leading-[1.8]">{thesis.summary}</p>
          ) : null}

          {lines.length > 0 ? (
            <div className="relative mt-6 border-t border-slate-200/90 pt-5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">本期信号要点</p>
              <ul className="mt-3 space-y-2.5 border-l-2 border-primary/25 pl-3 text-sm leading-relaxed text-slate-800">
                {lines.map((line, i) => (
                  <li key={i} className="[overflow-wrap:anywhere] break-words">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="relative mt-6 flex flex-wrap gap-1.5 border-t border-slate-200/90 pt-5">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">
              过去 7 天事件池
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] text-slate-600">
              Top 判断 {topJudgmentCount} 条
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] text-slate-600">
              噪音过滤 {noiseFilteredCount} 条
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] text-slate-600">
              阅读约 {readingMinutes} 分钟
            </span>
          </div>

          <div className="relative mt-5">
            <Link to="/#subscribe" className="btn-secondary inline-flex px-4 py-2 text-xs font-semibold no-underline md:text-sm">
              订阅周报
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
