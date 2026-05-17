import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** AI Pulse 榜单事件列表 — 排行榜 / 首页 / 周报共用视觉语言 */

export const pulseRankTitleZhCls =
  'line-clamp-2 text-[15px] font-medium leading-snug text-slate-800 [overflow-wrap:anywhere]';

/** 排行榜页事件主标题：偏黑体感的粗字重 */
export const pulseRankTitleZhBoldCls =
  'line-clamp-2 text-[15px] font-bold leading-snug text-[#0F172A] [overflow-wrap:anywhere]';

/** 周报等：不截断标题，便于在同一表格内阅读全文 */
export const pulseRankTitleZhBoldFullCls =
  'text-[15px] font-bold leading-snug text-[#0F172A] [overflow-wrap:anywhere]';

/** 周报 Top3：主标题 semibold，不换行截断 */
export const pulseRankTitleWeeklyZhCls =
  'text-[15px] font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]';

export const pulseRankTitleEnCls =
  'line-clamp-2 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]';

/** 周报英文副标题：最多两行，略小字号 */
export const pulseRankTitleEnWeeklyCls =
  'line-clamp-2 text-[11px] leading-relaxed text-slate-500 [overflow-wrap:anywhere] md:text-xs';

export const pulseRankMeaningCls =
  'line-clamp-3 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]';

/** 周报「对你意味着什么」：全文 + 舒适行距 */
export const pulseRankMeaningWeeklyFullCls =
  'text-sm leading-[1.65] text-slate-600 [overflow-wrap:anywhere]';

export const pulseRankDetailBtnCls =
  'inline-flex h-[34px] shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white px-[14px] text-[13px] font-medium text-blue-600 no-underline transition-colors hover:border-sky-300 hover:bg-sky-50';

const rankBadgeCls =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-600 tabular-nums';

export function PulseRankRankBadge({
  rank,
  paddedTwoDigits,
}: {
  rank: number;
  /** 周报 01 / 02 / 03 */
  paddedTwoDigits?: boolean;
}) {
  const label = paddedTwoDigits ? String(rank).padStart(2, '0') : String(rank);
  return <span className={rankBadgeCls}>{label}</span>;
}

export function PulseRankScoreCell({ score, compact }: { score: number | null; compact?: boolean }) {
  if (score == null || !Number.isFinite(score)) {
    return (
      <span
        className={`font-medium tabular-nums text-slate-400 ${compact ? 'text-base' : 'text-lg'}`}
      >
        —
      </span>
    );
  }
  return (
    <span
      className={`font-semibold tabular-nums text-blue-600 ${compact ? 'text-base' : 'text-lg'}`}
    >
      {score.toFixed(1)}
    </span>
  );
}

export function PulseRankEventTitles({
  titleZh,
  titleEn,
  sourceLabel,
  titleZhClassName = pulseRankTitleZhCls,
  titleEnClassName = pulseRankTitleEnCls,
  hintOverflowTitle,
}: {
  titleZh: string;
  titleEn?: string;
  /** 标题左上角：来源媒体 / 站点名 */
  sourceLabel?: string;
  /** 默认中等字重；排行榜页可传入 {@link pulseRankTitleZhBoldCls} */
  titleZhClassName?: string;
  /** 英文副标题样式（周报可 {@link pulseRankTitleEnWeeklyCls}） */
  titleEnClassName?: string;
  /** 悬停显示完整标题（截断样式下辅助阅读） */
  hintOverflowTitle?: boolean;
}) {
  const src = (sourceLabel ?? '').trim();
  return (
    <div className="min-w-0 space-y-1">
      {src ? (
        <p
          className="truncate text-[11px] font-medium leading-tight text-slate-500"
          title={hintOverflowTitle ? src : undefined}
        >
          {src}
        </p>
      ) : null}
      <h3 className={titleZhClassName} title={hintOverflowTitle ? titleZh : undefined}>
        {titleZh}
      </h3>
      {titleEn ? (
        <p className={titleEnClassName} title={hintOverflowTitle ? titleEn : undefined}>
          {titleEn}
        </p>
      ) : null}
    </div>
  );
}

export function PulseRankMeaningBlock({
  text,
  className,
  hintOverflowText,
}: {
  text: string;
  /** 默认三行截断；传入则可自定义（如周报展示全文） */
  className?: string;
  hintOverflowText?: boolean;
}) {
  return (
    <p className={className ?? pulseRankMeaningCls} title={hintOverflowText ? text : undefined}>
      {text}
    </p>
  );
}

export function PulseRankDetailLink({
  to,
  className,
  children = '查看详情',
}: {
  to: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link to={to} className={className ?? pulseRankDetailBtnCls}>
      {children}
    </Link>
  );
}

/** 周报 / 卡片式行的尾部箭头（与表格「查看详情」同气质） */
export function PulseRankRowChevron({ label = '查看详情' }: { label?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-slate-500">
      <span className="hidden sm:inline">{label}</span>
      <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-blue-600" aria-hidden />
    </span>
  );
}
