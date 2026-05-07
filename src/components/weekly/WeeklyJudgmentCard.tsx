/** 本周判断：仅展示主判断文案（不展示 weekly_thesis.summary 长段落） */

type Props = {
  headline: string;
};

export function WeeklyJudgmentCard({ headline }: Props) {
  return (
    <article className="rounded-[12px] border border-[#D8E2F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.05)] md:p-8">
      <p className="text-[13px] font-bold text-[#2563EB]">本周判断</p>
      <p className="mt-4 font-headline text-[20px] font-extrabold leading-[1.38] text-[#0F172A] md:text-[22px] [overflow-wrap:anywhere]">
        {headline}
      </p>
    </article>
  );
}
