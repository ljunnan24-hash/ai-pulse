/**
 * 排行榜 / 首页 Top5 / 周报 Top3 共用：同一套栅格、字重与分类 pill。
 */

import type { WeeklyCategoryResolved } from '../../lib/weeklyCategoryDisplay';
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

/** 排名 | Score | 事件 | 发生了什么 | 分类（含行业细分标签） | 操作（与排行榜页一致） */
export const PULSE_RANKINGS_TABLE_GRID_COLUMNS =
  '72px minmax(56px, 68px) minmax(280px, 2.2fr) minmax(180px, 1.25fr) minmax(88px, 118px) 112px' as const;

export const pulseRankingsTableWrapCls =
  'overflow-hidden rounded-[22px] border border-[#D8E2F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]';

export type PulseRankingsTableRow = {
  key: string;
  rank: number;
  /** 周报等：01 / 02 / 03 */
  rankPaddedTwoDigits?: boolean;
  score: number | null;
  titleZh: string;
  titleEn?: string;
  /** 标题上方来源（媒体名 / 域名） */
  sourceLabel?: string;
  meaning: string;
  categorySlug: string;
  /** 站内 `/events/:id` */
  detailTo?: string;
  /** 外链（与 detailTo 互斥，优先 detailTo） */
  externalUrl?: string;
  /** 覆盖中文标题样式（默认 {@link pulseRankTitleZhBoldCls}） */
  titleZhClassName?: string;
  /** 覆盖英文副标题样式 */
  titleEnClassName?: string;
  /** 覆盖「发生了什么」段落样式（周报等可不截断全文） */
  meaningClassName?: string;
  /** 为标题/摘要设置原生 title 悬停提示（窄屏截断时备用） */
  overflowHints?: boolean;
  /**
   * 周报专用：传入则覆盖默认 categorySlug/categoryLabel（含「未分类」占位，不用「—」）。
   * `undefined` = 走排行榜默认逻辑。
   */
  weeklyCategoryResolved?: WeeklyCategoryResolved | null;
  /** 周报操作列文案：查看来源 / 暂无详情 */
  weeklyUi?: boolean;
  /** 领域/场景补充标签（API 仍为 industry_tags；最多展示 2 个由组件内 slice） */
  industryTags?: Array<{ slug: string; label: string }>;
};

/** 大类 pill 下的补充说明（比大类 pill 更轻）；叠放在「分类」列纵向第二行 */
export function IndustryTagPills({
  tags,
  className = '',
}: {
  tags: Array<{ slug: string; label: string }>;
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {tags.slice(0, 2).map((t) => (
        <span
          key={t.slug}
          className="inline-flex max-w-[min(10rem,100%)] truncate rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium leading-tight text-slate-500 ring-1 ring-slate-200/90"
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function RankingsCategoryCell({ row }: { row: PulseRankingsTableRow }) {
  if (row.weeklyCategoryResolved !== undefined) {
    if (row.weeklyCategoryResolved === null) {
      return (
        <span className="inline-flex max-w-full whitespace-nowrap rounded-full bg-slate-50 px-2 py-0.5 text-center text-[11px] font-medium leading-tight text-slate-400 ring-1 ring-slate-200/90">
          未分类
        </span>
      );
    }
    const { slug, label } = row.weeklyCategoryResolved;
    return (
      <span
        className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-0.5 text-center text-[12px] font-semibold leading-tight ${categoryPillClass(slug)}`}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex max-w-full whitespace-nowrap rounded-full px-2.5 py-0.5 text-center text-[12px] font-semibold leading-tight ${categoryPillClass(row.categorySlug)}`}
    >
      {categoryLabel(row.categorySlug)}
    </span>
  );
}

function PulseRankingsActionCell({
  detailTo,
  externalUrl,
  mobileFullWidth,
  weeklyUi,
}: {
  detailTo?: string;
  externalUrl?: string;
  mobileFullWidth?: boolean;
  weeklyUi?: boolean;
}) {
  const mobileCls = mobileFullWidth ? `${pulseRankDetailBtnCls} inline-flex self-start` : pulseRankDetailBtnCls;

  if (detailTo) {
    return <PulseRankDetailLink to={detailTo} className={mobileCls} />;
  }
  if (externalUrl) {
    return (
      <a href={externalUrl} target="_blank" rel="noreferrer" className={`${pulseRankDetailBtnCls} no-underline ${mobileCls}`}>
        {weeklyUi ? '查看来源' : '查看详情'}
      </a>
    );
  }
  return (
    <span className={`${pulseRankDetailBtnCls} cursor-not-allowed opacity-50 ${mobileCls}`} aria-disabled>
      {weeklyUi ? '暂无详情' : '查看详情'}
    </span>
  );
}

export function PulseRankingsTableLayout({
  rows,
  scoreColumnLabel = 'Pulse Score',
}: {
  rows: PulseRankingsTableRow[];
  /** 表头分数列文案；周报使用「本周分」 */
  scoreColumnLabel?: string;
}) {
  if (rows.length === 0) return null;

  const stickyActionWrap = 'sticky right-0 z-[2] -mr-px bg-white pl-2 shadow-[-12px_0_14px_-10px_rgba(15,23,42,0.1)]';

  return (
    <div className={`${pulseRankingsTableWrapCls} max-w-full overflow-x-auto`}>
      <div className="hidden md:block min-w-[920px]">
        <div
          className="grid h-12 items-center gap-x-3 border-b border-[#E2E8F0] bg-white px-4 text-left text-[13px] font-semibold text-slate-500"
          style={{ gridTemplateColumns: PULSE_RANKINGS_TABLE_GRID_COLUMNS }}
        >
          <span className="text-center">排名</span>
          <span>{scoreColumnLabel}</span>
          <span>事件</span>
          <span>发生了什么</span>
          <span className="text-center">分类</span>
          <span className={`text-left ${stickyActionWrap}`}>操作</span>
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
                  sourceLabel={r.sourceLabel}
                  titleZhClassName={r.titleZhClassName ?? pulseRankTitleZhBoldCls}
                  titleEnClassName={r.titleEnClassName}
                  hintOverflowTitle={r.overflowHints}
                />
              </div>
              <div className="min-w-0">
                <PulseRankMeaningBlock
                  text={r.meaning}
                  className={r.meaningClassName}
                  hintOverflowText={r.overflowHints}
                />
              </div>
              <div className="flex flex-col items-center justify-center gap-1.5 self-center pt-0.5 text-center" role="cell">
                <RankingsCategoryCell row={r} />
                <IndustryTagPills tags={r.industryTags ?? []} className="max-w-full justify-center" />
              </div>
              <div className={`flex justify-start ${stickyActionWrap}`}>
                <PulseRankingsActionCell
                  detailTo={r.detailTo}
                  externalUrl={r.externalUrl}
                  weeklyUi={r.weeklyUi}
                />
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
                sourceLabel={r.sourceLabel}
                titleZhClassName={r.titleZhClassName ?? pulseRankTitleZhBoldCls}
                titleEnClassName={r.titleEnClassName}
                hintOverflowTitle={r.overflowHints}
              />
            </div>
            <div className="mt-2 min-w-0">
              <PulseRankMeaningBlock
                text={r.meaning}
                className={r.meaningClassName}
                hintOverflowText={r.overflowHints}
              />
            </div>
            <div className="mt-2 flex flex-col items-start gap-1.5">
              <RankingsCategoryCell row={r} />
              <IndustryTagPills tags={r.industryTags ?? []} className="justify-start" />
            </div>
            <div className="mt-4 flex justify-start">
              <PulseRankingsActionCell
                detailTo={r.detailTo}
                externalUrl={r.externalUrl}
                mobileFullWidth
                weeklyUi={r.weeklyUi}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
