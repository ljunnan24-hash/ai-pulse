import { Link } from 'react-router-dom';

import type { HomeRankingItem } from '../../lib/homeRankingsDisplay';
import { chineseIntroHeadline, originalTitleLine, pulseDisplayScore, whatItMeansCell } from '../../lib/homeRankingsDisplay';

type Props = {
  items: HomeRankingItem[];
};

const COL_DESKTOP = '72px 96px minmax(360px,1.5fr) minmax(220px,0.9fr) 120px' as const;

export function HomeTopFiveTable({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="card-surface overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
      {/* Desktop */}
      <div className="hidden md:block">
        <div
          className="grid items-center gap-x-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500"
          style={{ gridTemplateColumns: COL_DESKTOP }}
        >
          <span className="text-center">排名</span>
          <span>Pulse</span>
          <span>事件与简介</span>
          <span>对你意味着什么</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-slate-100">
        {items.map((item, idx) => {
          const rank = idx + 1;
          const pulse = pulseDisplayScore(item);
          const intro = chineseIntroHeadline(item);
          const rawTitle = originalTitleLine(item);
          const means = whatItMeansCell(item);
          return (
            <div
              key={item.id}
              className="grid items-start gap-x-3 px-4 py-4"
              style={{ gridTemplateColumns: COL_DESKTOP }}
            >
              <div className="flex justify-center pt-0.5">
                <span className="font-headline text-lg font-bold tabular-nums text-primary">{rank}</span>
              </div>
              <div className="pt-0.5">
                <span className="font-headline text-sm tabular-nums text-slate-700">{pulse.toFixed(1)}</span>
              </div>
              <div className="min-w-0">
                <p className="font-headline text-sm font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">{intro}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]">
                  原文标题：{rawTitle}
                </p>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{means}</p>
              </div>
              <div className="flex justify-end pt-0.5">
                <Link
                  to={`/events/${item.id}`}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 no-underline transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  查看详情
                </Link>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Mobile: compact stacked */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {items.map((item, idx) => {
          const rank = idx + 1;
          const pulse = pulseDisplayScore(item);
          const intro = chineseIntroHeadline(item);
          const rawTitle = originalTitleLine(item);
          const means = whatItMeansCell(item);
          return (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-headline text-base font-bold tabular-nums text-primary">{rank}</span>
                <span className="text-xs tabular-nums text-slate-600">
                  Pulse <span className="font-headline font-semibold">{pulse.toFixed(1)}</span>
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">{intro}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500 [overflow-wrap:anywhere]">原文标题：{rawTitle}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{means}</p>
              <Link
                to={`/events/${item.id}`}
                className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 no-underline"
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
