import { Link } from 'react-router-dom';

import type { RankingItem } from './RankingCard';
import { buildDisplayJudgment } from './RankingCard';
import { categoryLabel } from '../../lib/categoryLabels';
import { pulseDisplayScore } from '../../lib/homeRankingsDisplay';
import { displayActionSuggestion, displayInsightSummary } from '../../lib/insightFallback';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

type Variant = 'home' | 'rankings';

/** 首页：大号蓝色排名数字，独立列居中 */
function RankHomeNumeric({ rank, emphasis }: { rank: number; emphasis: boolean }) {
  return (
    <span
      className={`font-headline font-bold tabular-nums leading-none text-primary ${
        emphasis ? 'text-2xl' : 'text-lg'
      }`}
    >
      {rank}
    </span>
  );
}

/**
 * Pulse：排行榜页为目标图中的大号蓝色粗体；首页保持克制灰字。
 */
function PulseScoreCell({
  score,
  variant,
  rankTier,
}: {
  score: number;
  variant: Variant;
  rankTier: 'top3' | 'rest';
}) {
  const n = Number.isFinite(score) ? score.toFixed(1) : '—';
  const rankings = variant === 'rankings';
  const labelCls = 'text-[0.55rem] font-medium uppercase tracking-wide text-slate-400';
  const numCls = rankings
    ? `font-headline font-bold tabular-nums leading-none text-primary ${rankTier === 'top3' ? 'text-lg' : 'text-sm'}`
    : `font-headline tabular-nums text-slate-600 ${rankTier === 'top3' ? 'text-sm font-semibold' : 'text-xs font-medium'}`;
  return (
    <span className="inline-flex flex-col gap-0.5 leading-tight">
      <span className={labelCls}>Pulse</span>
      <span className={numCls}>{n}</span>
    </span>
  );
}

export function RowActionLink({ item }: { item: RankingItem }) {
  const sug = displayActionSuggestion(item.action_suggestion);
  const tryNow = sug.includes('试用');
  const cls = tryNow
    ? 'border-primary bg-white text-primary hover:bg-primary/5'
    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50';
  return (
    <Link
      to={`/events/${item.id}`}
      className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold no-underline transition-colors ${cls}`}
    >
      {tryNow ? '现在试用' : '继续阅读'}
    </Link>
  );
}

function auxiliaryTitle(item: RankingItem, jd: ReturnType<typeof buildDisplayJudgment>): string | null {
  const split = splitTitleForDisplay(item.title);
  const subRaw =
    split.secondary || (jd.text.trim() !== item.title.trim() ? item.title : '');
  const sub = subRaw && subRaw.trim() !== jd.text.trim() ? subRaw : '';
  return sub || null;
}

function judgmentSupplement(
  item: RankingItem,
  split: ReturnType<typeof splitTitleForDisplay>,
  jd: ReturnType<typeof buildDisplayJudgment>,
): string | null {
  if (!jd.text.trim()) return null;
  if (jd.text.trim() === split.primary.trim()) return null;
  if (split.secondary && jd.text.trim() === split.secondary.trim()) return null;
  return jd.text;
}

type DesktopProps = {
  rank: number;
  item: RankingItem;
  variant: Variant;
};

/** 桌面端：CSS Grid 一行；排行榜其余名次整行可点进详情；首页保留操作列 */
export function RankingTableRow({ rank, item, variant }: DesktopProps) {
  const jd = buildDisplayJudgment(item);
  const means = displayInsightSummary(item.what_it_means_for_you, item.what_happened);
  const split = splitTitleForDisplay(item.title);
  const jdExtra = judgmentSupplement(item, split, jd);
  const aux = auxiliaryTitle(item, jd);
  const isTop = rank <= 3;
  const eyebrow = jd.fromOneLiner ? 'AI Pulse 判断' : '摘要';

  const rowMin = isTop ? 'min-h-[96px]' : 'min-h-[72px]';
  const rankTier = isTop ? 'top3' : 'rest';

  const rowPad = isTop ? 'py-2.5' : 'py-1.5';

  if (variant === 'rankings') {
    return (
      <Link
        to={`/events/${item.id}`}
        className={`ranking-table-grid--rankings-rest border-b border-slate-100 bg-white px-2 py-1.5 transition-colors last:border-b-0 hover:bg-slate-50/80 md:px-3 min-h-[68px] no-underline`}
        role="row"
      >
        <div
          className="ranking-cell-rank -mx-2 flex shrink-0 items-start justify-center border-r border-slate-200 bg-slate-100 px-2 pt-1 md:-mx-3 md:px-3"
          role="cell"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center font-headline text-sm font-semibold tabular-nums text-slate-500">
            {rank}
          </span>
        </div>

        <div className="ranking-cell-pulse flex shrink-0 items-start justify-start pt-1" role="cell">
          <PulseScoreCell score={pulseDisplayScore(item)} variant={variant} rankTier="rest" />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-1 py-1" role="cell">
          <p className="font-headline text-sm font-semibold leading-snug text-[#111827] [overflow-wrap:anywhere]">
            {split.primary}
          </p>
          {split.secondary ? (
            <p className="text-xs leading-snug text-slate-500 [overflow-wrap:anywhere]">{split.secondary}</p>
          ) : null}
          {jdExtra ? (
            <p className="text-[0.7rem] leading-snug text-slate-500 [overflow-wrap:anywhere]">{jdExtra}</p>
          ) : null}
        </div>

        <div className="flex min-w-0 items-start pt-1" role="cell">
          <p className="text-[0.8125rem] leading-snug text-slate-600 [overflow-wrap:anywhere]">{means}</p>
        </div>

        <div className="flex items-start justify-center pt-1" role="cell">
          <span className="inline-flex max-w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-[0.65rem] font-medium leading-tight text-slate-700">
            {categoryLabel(item.category)}
          </span>
        </div>

        <div className="flex items-start pt-1.5 text-[0.7rem] tabular-nums text-slate-400" role="cell">
          {formatRelativeTime(item.published_at)}
        </div>
      </Link>
    );
  }

  return (
    <div
      className={`ranking-table-grid border-b border-slate-100 bg-white px-2 transition-colors last:border-b-0 hover:bg-slate-50/60 md:px-3 ${rowPad} ${rowMin}`}
      role="row"
    >
      <div
        className="ranking-cell-rank -mx-2 flex shrink-0 items-start justify-center border-r border-slate-200 bg-slate-100 px-2 pt-1 md:-mx-3 md:px-3"
        role="cell"
      >
        <RankHomeNumeric rank={rank} emphasis={isTop} />
      </div>

      <div className="ranking-cell-pulse flex shrink-0 items-start justify-start pt-1" role="cell">
        <PulseScoreCell score={pulseDisplayScore(item)} variant={variant} rankTier={rankTier} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden py-1" role="cell">
        <span className="text-[0.55rem] font-medium uppercase tracking-wide text-slate-400">{eyebrow}</span>
        <p
          className={`font-headline font-semibold leading-snug text-[#111827] [overflow-wrap:anywhere] line-clamp-2 ${
            isTop ? 'text-[0.95rem]' : 'text-sm'
          } ${jd.isTitleFallback ? 'font-medium text-slate-800' : ''}`}
        >
          {jd.text}
        </p>
        {aux ? (
          <p className="text-xs leading-snug text-slate-500 [overflow-wrap:anywhere] line-clamp-1">{aux}</p>
        ) : null}
      </div>

      <div className="flex min-w-0 items-start pt-1" role="cell">
        <p className="text-[0.8125rem] leading-snug text-slate-600 [overflow-wrap:anywhere] line-clamp-2">{means}</p>
      </div>

      <div className="flex items-start justify-center pt-1" role="cell">
        <span className="inline-flex max-w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-[0.65rem] font-medium leading-tight text-slate-700">
          {categoryLabel(item.category)}
        </span>
      </div>

      <div className="flex items-start pt-1.5 text-[0.7rem] tabular-nums text-slate-400" role="cell">
        {formatRelativeTime(item.published_at)}
      </div>

      <div className="flex items-start justify-end pt-1" role="cell">
        <RowActionLink item={item} />
      </div>
    </div>
  );
}
