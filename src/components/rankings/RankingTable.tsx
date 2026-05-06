import type { ReactNode } from 'react';

import type { RankingItem } from './RankingCard';
import { RankingTableHeader } from './RankingTableHeader';
import { RankingTableRow } from './RankingTableRow';

type Props = {
  variant: 'home' | 'rankings';
  items: RankingItem[];
  /** 置于容器底部，如「查看完整榜单」 */
  footer?: ReactNode;
  /**
   * 排行榜页：上方已有 Top 3 大卡时，表格从第 4 名开始，rank 显示为 4、5…
   */
  rankOffset?: number;
};

/**
 * 首页：列较多时用横向滚动避免挤压。
 * 排行榜（其余名次）：流体栅格，无整体 min-width，尽量避免横向滑条。
 */
export function RankingTable({ variant, items, footer, rankOffset = 0 }: Props) {
  const isRankings = variant === 'rankings';

  const inner = (
    <>
      <RankingTableHeader
        judgmentColumnLabel={variant === 'home' ? '判断与原文标题' : '判断（今日一句话）'}
        layout={isRankings ? 'rankings-rest' : 'home'}
      />
      {items.map((item, idx) => (
        <RankingTableRow key={item.id} rank={idx + 1 + rankOffset} item={item} variant={variant} />
      ))}
    </>
  );

  return (
    <div className={`card-surface overflow-hidden ${isRankings ? 'ring-1 ring-slate-200/80' : ''}`}>
      {isRankings ? (
        <div className="min-w-0">{inner}</div>
      ) : (
        <>
          <p className="border-b border-sky-100 bg-sky-50 px-3 py-2 text-center text-[0.75rem] font-medium text-sky-950 md:hidden">
            ← 左右滑动查看完整表格 →
          </p>
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <div className="min-w-[62rem]">{inner}</div>
          </div>
        </>
      )}
      {footer ? <div className="border-t border-slate-100 bg-white">{footer}</div> : null}
    </div>
  );
}
