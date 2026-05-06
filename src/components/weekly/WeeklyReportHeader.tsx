type Props = {
  reportDate: string;
  title: string;
};

export function WeeklyReportHeader({ reportDate, title }: Props) {
  const displayTitle = title.trim() || `AI Pulse 周报 · ${reportDate}`;

  return (
    <header id="weekly-report-top" className="mb-6 border-b border-slate-200/90 pb-6 md:mb-8 md:pb-8">
      <p className="text-sm font-medium text-slate-500">{reportDate}</p>
      <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-slate-900 md:text-[2.25rem] md:leading-tight">
        {displayTitle}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
        基于过去 7 天 AI Pulse 排行榜事件池生成
      </p>
    </header>
  );
}
