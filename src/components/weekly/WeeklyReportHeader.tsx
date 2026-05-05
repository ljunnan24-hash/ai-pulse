type Props = {
  reportDate: string;
  title: string;
  readingMinutes: number;
};

export function WeeklyReportHeader({ reportDate, title, readingMinutes }: Props) {
  const displayTitle = title.trim() || `AI Pulse 周报 · ${reportDate}`;

  return (
    <header id="weekly-report-top" className="mb-8 border-b border-slate-200/90 pb-8 md:mb-10">
      <p className="text-sm font-medium text-slate-500">{reportDate}</p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 md:text-[2rem] md:leading-tight">
          {displayTitle}
        </h1>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          阅读约 {readingMinutes} 分钟
        </span>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-500">
        基于过去 7 天 AI Pulse 排行榜事件池生成
      </p>
    </header>
  );
}
