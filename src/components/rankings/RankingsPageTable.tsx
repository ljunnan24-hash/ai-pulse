import type { RankingItem } from './RankingCard';
import {
  pulseDisplayScore,
  pulseEventTitleEn,
  pulseEventTitleZh,
  pulseWhatItMeans,
} from '../../lib/homeRankingsDisplay';
import { categoryLabel, categoryPillClass } from '../../lib/categoryLabels';
import {
  PulseRankDetailLink,
  PulseRankEventTitles,
  PulseRankMeaningBlock,
  PulseRankRankBadge,
  PulseRankScoreCell,
  pulseRankDetailBtnCls,
  pulseRankTitleZhBoldCls,
} from '../pulse/PulseRankItem';

type Props = {
  items: RankingItem[];
};

/** 排名 | Score(收窄) | 事件(加宽) | 对你意味着什么 | 分类 | 操作 */
const COL_DESKTOP =
  '72px minmax(56px, 68px) minmax(260px, 2fr) minmax(148px, 1.05fr) minmax(72px, 92px) 112px' as const;

const wrapCls =
  'overflow-hidden rounded-[22px] border border-[#D8E2F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]';

/** 榜单页：与首页 Top5 / 周报 Top3 共用 Pulse 事件列表样式 */
export function RankingsPageTable({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className={wrapCls}>
      <div className="hidden md:block">
        <div
          className="grid h-12 items-center gap-x-3 border-b border-[#E2E8F0] bg-white px-4 text-left text-[13px] font-semibold text-slate-500"
          style={{ gridTemplateColumns: COL_DESKTOP }}
        >
          <span className="text-center">排名</span>
          <span>Score</span>
          <span>事件</span>
          <span>对你意味着什么</span>
          <span className="text-center">分类</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          {items.map((item, idx) => {
            const rank = idx + 1;
            const pulse = pulseDisplayScore(item);
            const titleZh = pulseEventTitleZh(item);
            const titleEn = pulseEventTitleEn(item);
            const means = pulseWhatItMeans(item);
            return (
              <div
                key={item.id}
                className="grid items-center gap-x-3 bg-white px-4 py-4 md:py-5"
                style={{ gridTemplateColumns: COL_DESKTOP }}
              >
                <div className="flex justify-center">
                  <PulseRankRankBadge rank={rank} />
                </div>
                <div className="flex items-center justify-start">
                  <PulseRankScoreCell score={pulse} compact />
                </div>
                <div className="min-w-0">
                  <PulseRankEventTitles
                    titleZh={titleZh}
                    titleEn={titleEn}
                    titleZhClassName={pulseRankTitleZhBoldCls}
                  />
                </div>
                <div className="min-w-0">
                  <PulseRankMeaningBlock text={means} />
                </div>
                <div className="flex items-start justify-center pt-0.5" role="cell">
                  <span
                    className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-0.5 text-center text-[12px] font-semibold leading-tight ${categoryPillClass(item.category)}`}
                  >
                    {categoryLabel(item.category)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <PulseRankDetailLink to={`/events/${item.id}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="divide-y divide-[#E2E8F0] md:hidden">
        {items.map((item, idx) => {
          const rank = idx + 1;
          const pulse = pulseDisplayScore(item);
          const titleZh = pulseEventTitleZh(item);
          const titleEn = pulseEventTitleEn(item);
          const means = pulseWhatItMeans(item);
          return (
            <li key={item.id} className="bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <PulseRankRankBadge rank={rank} />
                <PulseRankScoreCell score={pulse} compact />
              </div>
              <div className="mt-3 min-w-0">
                <PulseRankEventTitles
                  titleZh={titleZh}
                  titleEn={titleEn}
                  titleZhClassName={pulseRankTitleZhBoldCls}
                />
              </div>
              <div className="mt-2 min-w-0">
                <PulseRankMeaningBlock text={means} />
              </div>
              <div className="mt-2 flex justify-start">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${categoryPillClass(item.category)}`}
                >
                  {categoryLabel(item.category)}
                </span>
              </div>
              <PulseRankDetailLink to={`/events/${item.id}`} className={`${pulseRankDetailBtnCls} mt-4 w-full justify-center`} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
