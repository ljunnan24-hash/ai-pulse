import { Link } from 'react-router-dom';

/** 无 weekly_thesis 时的精简封面 */

type Props = {
  readingMinutes: number;
  topJudgmentCount: number;
};

export function ReportCoverFallback({ readingMinutes, topJudgmentCount }: Props) {
  return (
    <section id="weekly-thesis" className="mb-8 scroll-mt-28 md:mb-10">
      <div className="card-surface p-5 md:p-6">
        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
          本周信息整理
        </span>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          下方按事实与价值提示展开，再看分类回顾与术语；先看信息，再对照辅助判断。
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">
            过去 7 天事件池
          </span>
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] text-slate-600">
            精选条目 {topJudgmentCount} 条
          </span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] text-slate-600">
            阅读约 {readingMinutes} 分钟
          </span>
        </div>
        <Link to="/subscribe" className="btn-secondary mt-5 inline-flex px-4 py-2 text-xs font-semibold no-underline md:text-sm">
          订阅周报
        </Link>
      </div>
    </section>
  );
}
