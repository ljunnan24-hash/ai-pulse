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

const chipBtn =
  'inline-flex h-[34px] shrink-0 items-center justify-center rounded-full border border-[#A8C5FF] bg-white px-[14px] text-[13px] font-bold text-[#2563EB] no-underline transition-colors hover:border-[#7DA7FF] hover:bg-[#EFF6FF]';

/** 榜单页：紧凑表格式 Top20；Top3 仅行底轻微区分，事件列与全表统一规格 */
export function RankingsPageTable({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className={wrapCls}>
      <div className="hidden md:block">
        <div
          className="grid h-12 items-center gap-x-3 border-b border-[#E2E8F0] bg-white px-4 text-left text-[13px] font-bold text-[#64748B]"
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
                className={`grid min-h-[80px] items-center gap-x-3 px-4 py-2 ${top3 ? 'bg-[#F8FAFC]/95' : 'bg-white'}`}
                style={{ gridTemplateColumns: COL_DESKTOP }}
              >
                <div className="flex justify-center">
                  <span className="font-headline text-[26px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                    {rank}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="font-headline text-[22px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                    {pulse.toFixed(1)}
                  </span>
                </div>
                <div className="min-w-0 py-1">
                  <p className="line-clamp-1 font-headline text-[16px] font-extrabold leading-[1.35] text-[#0F172A] [overflow-wrap:anywhere]">
                    {intro}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[13px] font-medium leading-[1.45] text-[#64748B] [overflow-wrap:anywhere]">
                    {rawTitle}
                  </p>
                </div>
                <div className="min-w-0 py-1">
                  <p className="line-clamp-2 text-[14px] font-normal leading-[1.65] text-[#475569] [overflow-wrap:anywhere]">
                    {means}
                  </p>
                </div>
                <div className="flex justify-end py-1">
                  <Link to={`/events/${item.id}`} className={chipBtn}>
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
            <li key={item.id} className={`px-4 py-3 ${top3 ? 'bg-[#F8FAFC]/90' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-headline text-[26px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                  {rank}
                </span>
                <span className="font-headline text-[22px] font-extrabold tabular-nums leading-none text-[#2563EB]">
                  {pulse.toFixed(1)}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 font-headline text-[16px] font-extrabold leading-[1.35] text-[#0F172A] [overflow-wrap:anywhere]">
                {intro}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[13px] font-medium leading-[1.45] text-[#64748B] [overflow-wrap:anywhere]">{rawTitle}</p>
              <p className="mt-2 line-clamp-2 text-[14px] font-normal leading-[1.65] text-[#475569] [overflow-wrap:anywhere]">{means}</p>
              <Link to={`/events/${item.id}`} className={`${chipBtn} mt-3 w-full justify-center`}>
                查看详情
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
