import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/** AI Pulse 榜单事件列表 — 排行榜 / 首页 / 周报共用视觉语言 */

export const pulseRankTitleZhCls =
  'line-clamp-2 text-[15px] font-medium leading-snug text-slate-800 [overflow-wrap:anywhere]';

export const pulseRankTitleEnCls =
  'line-clamp-2 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]';

export const pulseRankMeaningCls =
  'line-clamp-3 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]';

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

export function PulseRankScoreCell({ score }: { score: number }) {
  return <span className="text-lg font-semibold tabular-nums text-blue-600">{score.toFixed(1)}</span>;
}

export function PulseRankEventTitles({ titleZh, titleEn }: { titleZh: string; titleEn?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <h3 className={pulseRankTitleZhCls}>{titleZh}</h3>
      {titleEn ? <p className={pulseRankTitleEnCls}>{titleEn}</p> : null}
    </div>
  );
}

export function PulseRankMeaningBlock({ text }: { text: string }) {
  return <p className={pulseRankMeaningCls}>{text}</p>;
}

export function PulseRankDetailLink({
  to,
  className,
}: {
  to: string;
  className?: string;
}) {
  return (
    <Link to={to} className={className ?? pulseRankDetailBtnCls}>
      查看详情
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
