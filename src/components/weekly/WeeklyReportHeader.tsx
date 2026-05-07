type Props = {
  reportDate: string;
  title: string;
};

export function WeeklyReportHeader({ reportDate, title }: Props) {
  const displayTitle = title.trim() || `AI Pulse 周报 · ${reportDate}`;

  return (
    <header id="weekly-report-top" className="mb-10 md:mb-12">
      <p className="text-[13px] font-medium tabular-nums text-[#64748B]">{reportDate}</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-headline text-[28px] font-extrabold leading-[1.2] tracking-tight text-[#0F172A] md:text-[30px]">
            {displayTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-[1.7] text-[#64748B]">
            基于过去 7 天收录与整理的关键信息，先呈现事实与线索，再附轻量价值提示
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 rounded-full border border-[#E2E8F0] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#64748B] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          5 分钟读懂本周
        </span>
      </div>
    </header>
  );
}
