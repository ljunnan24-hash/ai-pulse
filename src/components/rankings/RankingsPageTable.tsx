import { Link } from 'react-router-dom';

import type { RankingItem } from './RankingCard';
import {
  chineseIntroHeadline,
  originalTitleLine,
  pulseDisplayScore,
  whatItMeansCell,
} from '../../lib/homeRankingsDisplay';

type Props = {
  items: RankingItem[];
};

const COL_DESKTOP = '64px 84px minmax(260px,1.45fr) minmax(160px,1fr) 108px' as const;

const wrapCls =
  'overflow-hidden rounded-[22px] border border-[#D8E2F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]';

/** 榜单页专用：与首页 Top5 同列逻辑，支持 Top20；Top3 行略强调，无奖牌图形 */
export function RankingsPageTable({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className={wrapCls}>
      <div className="hidden md:block">
        <div
          className="grid h-11 items-center gap-x-3 border-b border-[#E2E8F0] bg-white px-4 text-left text-[13px] font-bold text-[#94A3B8]"
          style={{ gridTemplateColumns: COL_DESKTOP }}
        >
          <span className="text-center">排名</span>
          <span>Score</span>
          <span>事件与简介</span>
          <span>对你意味着什么</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          {items.map((item, idx) => {
            const rank = idx + 1;
            const top3 = rank <= 3;
            const pulse = pulseDisplayScore(item);
            const intro = chineseIntroHeadline(item);
            const rawTitle = originalTitleLine(item);
            const means = whatItMeansCell(item);
            return (
              <div
                key={item.id}
                className={`grid min-h-[68px] items-center gap-x-3 px-4 py-1.5 ${top3 ? 'bg-[#F8FAFC]/95' : ''}`}
                style={{ gridTemplateColumns: COL_DESKTOP }}
              >
                <div className="flex justify-center">
                  <span
                    className={`font-headline font-extrabold tabular-nums leading-none text-[#2563EB] ${top3 ? 'text-[28px]' : 'text-[26px]'}`}
                  >
                    {rank}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-headline text-[20px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                    {pulse.toFixed(1)}
                  </span>
                </div>
                <div className="min-w-0 py-0.5">
                  <p
                    className={`line-clamp-2 font-headline leading-[1.35] text-[#0F172A] [overflow-wrap:anywhere] ${top3 ? 'text-[16px] font-extrabold md:text-[17px]' : 'text-[15px] font-bold md:text-[16px]'}`}
                  >
                    {intro}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-[#64748B] [overflow-wrap:anywhere] md:text-[13px]">
                    {rawTitle}
                  </p>
                </div>
                <div className="min-w-0 py-0.5">
                  <p className="line-clamp-3 text-[13px] font-normal leading-[1.6] text-[#475569] [overflow-wrap:anywhere] md:text-[14px] md:leading-[1.65]">
                    {means}
                  </p>
                </div>
                <div className="flex justify-end py-0.5">
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

      <ul className="divide-y divide-[#E2E8F0] md:hidden">
        {items.map((item, idx) => {
          const rank = idx + 1;
          const top3 = rank <= 3;
          const pulse = pulseDisplayScore(item);
          const intro = chineseIntroHeadline(item);
          const rawTitle = originalTitleLine(item);
          const means = whatItMeansCell(item);
          return (
            <li key={item.id} className={`px-4 py-2.5 ${top3 ? 'bg-[#F8FAFC]/90' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`font-headline font-extrabold tabular-nums leading-none text-[#2563EB] ${top3 ? 'text-[26px]' : 'text-[24px]'}`}
                >
                  {rank}
                </span>
                <span className="font-headline text-[18px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                  {pulse.toFixed(1)}
                </span>
              </div>
              <p
                className={`mt-1.5 line-clamp-2 font-headline leading-snug text-[#0F172A] [overflow-wrap:anywhere] ${top3 ? 'text-[15px] font-extrabold' : 'text-[14px] font-bold'}`}
              >
                {intro}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.5] text-[#64748B] [overflow-wrap:anywhere]">{rawTitle}</p>
              <p className="mt-1.5 line-clamp-3 text-[12px] leading-[1.65] text-[#475569] [overflow-wrap:anywhere]">{means}</p>
              <Link
                to={`/events/${item.id}`}
                className="mt-2.5 inline-flex h-[34px] items-center justify-center rounded-full border border-[#A8C5FF] bg-white px-[14px] text-[13px] font-bold text-[#2563EB] no-underline"
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
