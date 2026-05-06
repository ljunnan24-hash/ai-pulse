import type { ReactNode } from 'react';

import type { RankingItem } from './RankingCard';
import { RankingTableHeader } from './RankingTableHeader';
import { RankingTableMobileRow, RankingTableRow } from './RankingTableRow';

type Props = {
  variant: 'home' | 'rankings';
  items: RankingItem[];
  /** 置于容器底部，如「查看完整榜单」 */
  footer?: ReactNode;
};

/**
 * 企业级榜单：
 * - 排行榜页（rankings）：任意宽度都用 Grid 表（窄屏横向滑动），避免误以为是「没改的卡片栈」
 * - 首页 Top5（home）：窄屏仍用紧凑纵向栈，桌面用 Grid
 */
export function RankingTable({ variant, items, footer }: Props) {
  const tableInner = (
    <>
      <RankingTableHeader
        judgmentColumnLabel={
          variant === 'home' ? '判断与原文标题' : '判断（今日一句话）'
        }
      />
      {items.map((item, idx) => (
        <RankingTableRow key={item.id} rank={idx + 1} item={item} variant={variant} />
      ))}
    </>
  );

  if (variant === 'rankings') {
    return (
      <div className="card-surface overflow-hidden ring-1 ring-slate-200/80">
        <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-center text-[0.7rem] text-slate-500 md:hidden">
          左右滑动查看完整榜单表格
        </p>
        <div className="overflow-x-auto overscroll-x-contain">
          <div className="min-w-[62rem]">
            {tableInner}
          </div>
        </div>
        {footer ? <div className="border-t border-slate-100 bg-white">{footer}</div> : null}
      </div>
    );
  }

  return (
    <div className="card-surface overflow-hidden">
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[62rem]">{tableInner}</div>
        </div>
      </div>

      <div className="md:hidden">
        {items.map((item, idx) => (
          <RankingTableMobileRow key={item.id} rank={idx + 1} item={item} variant={variant} />
        ))}
      </div>

      {footer ? <div className="border-t border-slate-100">{footer}</div> : null}
    </div>
  );
}
