/** 本周判断：结论卡 — 主判断与补充各最多两行 */

type Props = {
  headline: string;
  summary?: string;
};

export function WeeklyJudgmentCard({ headline, summary }: Props) {
  return (
    <article className="rounded-[12px] border border-[#D8E2F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.05)] md:p-8">
      <p className="text-[13px] font-bold text-[#2563EB]">本周判断</p>
      <p className="mt-4 line-clamp-2 font-headline text-[20px] font-extrabold leading-[1.38] text-[#0F172A] md:text-[22px]">
        {headline}
      </p>
      {summary ? (
        <p className="mt-3 line-clamp-2 text-[15px] leading-[1.65] text-[#64748B]">{summary}</p>
      ) : null}
    </article>
  );
}
