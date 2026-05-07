import { Link } from 'react-router-dom';

import type { HomeRankingItem } from '../../lib/homeRankingsDisplay';
import { chineseIntroHeadline, originalTitleLine, pulseDisplayScore, whatItMeansCell } from '../../lib/homeRankingsDisplay';

type Props = {
  items: HomeRankingItem[];
};

const COL_DESKTOP = '64px 84px minmax(260px,1.45fr) minmax(160px,1fr) 108px' as const;

const wrapCls =
  'overflow-hidden rounded-[22px] border border-[#E8EEF6] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]';

export function HomeTopFiveTable({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className={wrapCls}>
      {/* Desktop */}
      <div className="hidden md:block">
        <div
          className="grid h-12 items-center gap-x-3 border-b border-[#EEF2F7] bg-white px-4 text-left text-[13px] font-bold text-[#94A3B8]"
          style={{ gridTemplateColumns: COL_DESKTOP }}
        >
          <span className="text-center">排名</span>
          <span>Score</span>
          <span>事件与简介</span>
          <span>对你意味着什么</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-[#EEF2F7]">
          {items.map((item, idx) => {
            const rank = idx + 1;
            const pulse = pulseDisplayScore(item);
            const intro = chineseIntroHeadline(item);
            const rawTitle = originalTitleLine(item);
            const means = whatItMeansCell(item);
            return (
              <div
                key={item.id}
                className="grid min-h-[82px] items-center gap-x-3 px-4 py-2"
                style={{ gridTemplateColumns: COL_DESKTOP }}
              >
                <div className="flex justify-center">
                  <span className="font-headline text-[26px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                    {rank}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-headline text-[20px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                    {pulse.toFixed(1)}
                  </span>
                </div>
                <div className="min-w-0 py-1">
                  <p className="line-clamp-2 font-headline text-[16px] font-extrabold leading-[1.35] text-[#0F172A] [overflow-wrap:anywhere]">
                    {intro}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-[#64748B] [overflow-wrap:anywhere]">{rawTitle}</p>
                </div>
                <div className="min-w-0 py-1">
                  <p className="line-clamp-3 text-[14px] font-normal leading-[1.65] text-[#475569] [overflow-wrap:anywhere]">
                    {means}
                  </p>
                </div>
                <div className="flex justify-end py-1">
                  <Link
                    to={`/events/${item.id}`}
                    className="inline-flex h-[34px] shrink-0 items-center justify-center rounded-full border border-[#A8C5FF] bg-white px-[14px] text-[13px] font-bold text-[#2563EB] no-underline transition-colors hover:bg-[#F8FAFF]"
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-[#EEF2F7] md:hidden">
        {items.map((item, idx) => {
          const rank = idx + 1;
          const pulse = pulseDisplayScore(item);
          const intro = chineseIntroHeadline(item);
          const rawTitle = originalTitleLine(item);
          const means = whatItMeansCell(item);
          return (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-headline text-[24px] font-extrabold tabular-nums leading-none text-[#2563EB]">{rank}</span>
                <span className="font-headline text-[18px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                  {pulse.toFixed(1)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 font-headline text-[15px] font-extrabold leading-snug text-[#0F172A] [overflow-wrap:anywhere]">
                {intro}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-[#64748B] [overflow-wrap:anywhere]">{rawTitle}</p>
              <p className="mt-2 line-clamp-3 text-[13px] leading-[1.65] text-[#475569] [overflow-wrap:anywhere]">{means}</p>
              <Link
                to={`/events/${item.id}`}
                className="mt-3 inline-flex h-[34px] items-center justify-center rounded-full border border-[#A8C5FF] bg-white px-[14px] text-[13px] font-bold text-[#2563EB] no-underline"
              >
                查看详情
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
