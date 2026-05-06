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
    <section id="weekly-thesis" className="mb-10 scroll-mt-28 md:mb-12">
      <div className="relative overflow-hidden rounded-3xl border border-[#005bc1]/20 bg-gradient-to-br from-[#dbeafe]/90 via-white to-[#f0f7ff] p-7 shadow-[0_16px_48px_rgba(0,91,193,0.1)] md:p-9">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-white/95 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#005bc1] shadow-sm ring-1 ring-[#005bc1]/15">
            本周一句话判断
          </span>
        </div>

        {thesis.headline ? (
          <p className="mt-5 font-headline text-2xl font-bold leading-snug text-slate-900 md:text-[1.85rem] md:leading-snug">
            {thesis.headline}
          </p>
        ) : null}

        {thesis.summary ? (
          <p className="mt-5 text-base leading-[1.75] text-slate-700 md:text-[1.05rem]">{thesis.summary}</p>
        ) : null}

        {lines.length > 0 ? (
          <div className="mt-8 border-t border-[#005bc1]/12 pt-7">
            <p className="text-xs font-semibold text-slate-600">趋势线</p>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-800">
              {lines.map((line, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#005bc1]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-white/80 bg-white/70 px-4 py-4 backdrop-blur-sm md:px-5">
          <p className="text-xs font-semibold text-slate-500">报告基于</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              过去 7 天 AI Pulse 事件池
            </span>
            <span className="rounded-full border border-[#005bc1]/20 bg-[#005bc1]/5 px-3 py-1 text-xs font-semibold text-[#004291]">
              Top 判断 {topJudgmentCount} 条
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              噪音过滤 {noiseFilteredCount} 条
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              阅读约 {readingMinutes} 分钟
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/#subscribe"
            className="inline-flex justify-center rounded-full bg-[#005bc1] px-6 py-3 text-center font-headline text-sm font-bold text-white shadow-md hover:bg-[#004a9e]"
          >
            订阅每周判断报告
          </Link>
        </div>
      </div>
    </section>
  );
}
