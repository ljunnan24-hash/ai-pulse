import { Link } from 'react-router-dom';

/** 无 weekly_thesis 时的精简封面条，仍保留「报告感」与订阅入口 */

type Props = {
  readingMinutes: number;
  topJudgmentCount: number;
  noiseFilteredCount: number;
};

export function ReportCoverFallback({ readingMinutes, topJudgmentCount, noiseFilteredCount }: Props) {
  return (
    <section id="weekly-thesis" className="mb-10 scroll-mt-28 md:mb-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)] md:p-8">
        <p className="text-sm font-medium text-slate-600">
          本期主线判断与结构化章节见下方：<span className="font-semibold text-slate-900">Top 3 判断、能力边界与噪音过滤</span>。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-[#f7f9fc] px-3 py-1 text-xs font-medium text-slate-700">
            过去 7 天事件池
          </span>
          <span className="rounded-full border border-[#005bc1]/20 bg-[#005bc1]/5 px-3 py-1 text-xs font-semibold text-[#004291]">
            Top 判断 {topJudgmentCount} 条
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            噪音过滤 {noiseFilteredCount} 条
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            阅读约 {readingMinutes} 分钟
          </span>
        </div>
        <Link
          to="/#subscribe"
          className="mt-6 inline-flex rounded-full border-2 border-[#005bc1] bg-white px-5 py-2.5 font-headline text-sm font-bold text-[#005bc1] hover:bg-[#005bc1]/5"
        >
          订阅每周判断报告
        </Link>
      </div>
    </section>
  );
}
