/**
 * 排行榜 / 首页 Top5 / 周报 Top3 共用：同一套栅格、字重与分类 pill。
 */

import { categoryLabel, categoryPillClass } from '../../lib/categoryLabels';
import {
  PulseRankDetailLink,
  PulseRankEventTitles,
  PulseRankMeaningBlock,
  PulseRankRankBadge,
  PulseRankScoreCell,
  pulseRankDetailBtnCls,
  pulseRankTitleZhBoldCls,
} from './PulseRankItem';

/** 排名 | Score | 事件 | 对你意味着什么 | 分类 | 操作 */
export const PULSE_RANKINGS_TABLE_GRID_COLUMNS =
  '72px minmax(56px, 68px) minmax(280px, 2.2fr) minmax(180px, 1.25fr) minmax(72px, 92px) 112px' as const;

export const pulseRankingsTableWrapCls =
  'overflow-hidden rounded-[22px] border border-[#D8E2F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]';

export type PulseRankingsTableRow = {
  key: string;
  rank: number;
  /** 周报等：01 / 02 / 03 */
  rankPaddedTwoDigits?: boolean;
  score: number;
  titleZh: string;
  titleEn?: string;
  meaning: string;
  categorySlug: string;
  /** 站内 `/events/:id` */
  detailTo?: string;
  /** 外链（与 detailTo 互斥，优先 detailTo） */
  externalUrl?: string;
  /** 覆盖「对你意味着什么」段落样式（周报等可不截断全文） */
  meaningClassName?: string;
};

function PulseRankingsActionCell({
  detailTo,
  externalUrl,
  mobileFullWidth,
}: {
  detailTo?: string;
  externalUrl?: string;
  mobileFullWidth?: boolean;
}) {
  const mobileCls = mobileFullWidth ? `${pulseRankDetailBtnCls} mt-4 w-full justify-center` : pulseRankDetailBtnCls;

  if (detailTo) {
    return <PulseRankDetailLink to={detailTo} className={mobileCls} />;
  }
  if (externalUrl) {
    return (
      <a href={externalUrl} target="_blank" rel="noreferrer" className={`${pulseRankDetailBtnCls} no-underline ${mobileCls}`}>
        查看详情
      </a>
    );
  }
  return (
    <span className={`${pulseRankDetailBtnCls} cursor-default opacity-45 ${mobileCls}`} aria-disabled>
      查看详情
    </span>
  );
}

export function PulseRankingsTableLayout({ rows }: { rows: PulseRankingsTableRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className={pulseRankingsTableWrapCls}>
      <div className="hidden md:block">
        <div
          className="grid h-12 items-center gap-x-3 border-b border-[#E2E8F0] bg-white px-4 text-left text-[13px] font-semibold text-slate-500"
          style={{ gridTemplateColumns: PULSE_RANKINGS_TABLE_GRID_COLUMNS }}
        >
          <span className="text-center">排名</span>
          <span>Score</span>
          <span>事件</span>
          <span>对你意味着什么</span>
          <span className="text-center">分类</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          {rows.map((r) => (
            <div
              key={r.key}
              className="grid items-center gap-x-3 bg-white px-4 py-4 md:py-5"
              style={{ gridTemplateColumns: PULSE_RANKINGS_TABLE_GRID_COLUMNS }}
            >
              <div className="flex justify-center">
                <PulseRankRankBadge rank={r.rank} paddedTwoDigits={r.rankPaddedTwoDigits} />
              </div>
              <div className="flex items-center justify-start">
                <PulseRankScoreCell score={r.score} compact />
              </div>
              <div className="min-w-0">
                <PulseRankEventTitles
                  titleZh={r.titleZh}
                  titleEn={r.titleEn}
                  titleZhClassName={pulseRankTitleZhBoldCls}
                />
              </div>
              <div className="min-w-0">
                <PulseRankMeaningBlock text={r.meaning} className={r.meaningClassName} />
              </div>
              <div className="flex items-start justify-center pt-0.5" role="cell">
                <span
                  className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-0.5 text-center text-[12px] font-semibold leading-tight ${categoryPillClass(r.categorySlug)}`}
                >
                  {categoryLabel(r.categorySlug)}
                </span>
              </div>
              <div className="flex justify-end">
                <PulseRankingsActionCell detailTo={r.detailTo} externalUrl={r.externalUrl} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <ul className="divide-y divide-[#E2E8F0] md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <PulseRankRankBadge rank={r.rank} paddedTwoDigits={r.rankPaddedTwoDigits} />
              <PulseRankScoreCell score={r.score} compact />
            </div>
            <div className="mt-3 min-w-0">
              <PulseRankEventTitles
                titleZh={r.titleZh}
                titleEn={r.titleEn}
                titleZhClassName={pulseRankTitleZhBoldCls}
              />
            </div>
            <div className="mt-2 min-w-0">
              <PulseRankMeaningBlock text={r.meaning} className={r.meaningClassName} />
            </div>
            <div className="mt-2 flex justify-start">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${categoryPillClass(r.categorySlug)}`}
              >
                {categoryLabel(r.categorySlug)}
              </span>
            </div>
            <PulseRankingsActionCell detailTo={r.detailTo} externalUrl={r.externalUrl} mobileFullWidth />
          </li>
        ))}
      </ul>
    </div>
  );
}
