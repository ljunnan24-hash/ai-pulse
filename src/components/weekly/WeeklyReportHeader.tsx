type Props = {
  reportDate: string;
  title: string;
  readingMinutes: number;
};

export function WeeklyReportHeader({ reportDate, title, readingMinutes }: Props) {
  const displayTitle = title.trim() || `AI Pulse 周报 · ${reportDate}`;

  return (
    <header id="weekly-report-top" className="mb-5 border-b border-slate-200 pb-5 md:mb-6 md:pb-6">
      <p className="text-xs font-medium tabular-nums text-slate-500">{reportDate}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-[#111827] md:text-[1.85rem] md:leading-snug">
          {displayTitle}
        </h1>
        <span className="inline-flex w-fit shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium tabular-nums text-slate-600">
          阅读约 {readingMinutes} 分钟
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-[0.95rem]">
        基于过去 7 天收录与整理的关键信息，先呈现事实与线索，再附轻量价值提示
      </p>
    </header>
  );
}
