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
 * 企业级榜单：card-surface 内桌面 Grid + 移动端紧凑栈
 */
export function RankingTable({ variant, items, footer }: Props) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[62rem]">
            <RankingTableHeader
              judgmentColumnLabel={
                variant === 'home' ? '判断与原文标题' : '判断（今日一句话）'
              }
            />
            {items.map((item, idx) => (
              <RankingTableRow key={item.id} rank={idx + 1} item={item} variant={variant} />
            ))}
          </div>
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
