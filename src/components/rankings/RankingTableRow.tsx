import { Link } from 'react-router-dom';

import type { RankingItem } from './RankingCard';
import { buildDisplayJudgment } from './RankingCard';
import { categoryLabel } from '../../lib/categoryLabels';
import { displayActionSuggestion, displayInsightSummary } from '../../lib/insightFallback';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

/** 排行榜页 Top3：金银铜圆章 */
function RankMedal({ rank }: { rank: number }) {
  const medal = [
    'bg-amber-100 text-amber-900 ring-2 ring-amber-300/80',
    'bg-slate-200 text-slate-800 ring-2 ring-slate-400/70',
    'bg-orange-100 text-orange-950 ring-2 ring-orange-300/80',
  ];
  if (rank <= 3) {
    return (
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${medal[rank - 1]}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center font-headline text-sm font-semibold tabular-nums text-slate-600">
      {rank}
    </span>
  );
}

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

/** Pulse：辅助列，不抢主视觉 */
function PulseScoreCell({ score, compact }: { score: number; compact: boolean }) {
  const n = Number.isFinite(score) ? score.toFixed(1) : '—';
  return (
    <span className="inline-flex flex-col gap-0 leading-tight">
      <span
        className={`font-medium uppercase tracking-wide text-slate-400 ${compact ? 'text-[0.5rem]' : 'text-[0.55rem]'}`}
      >
        Pulse
      </span>
      <span
        className={`font-headline tabular-nums text-slate-600 ${compact ? 'text-xs font-medium' : 'text-sm font-semibold'}`}
      >
        {n}
      </span>
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

type Variant = 'home' | 'rankings';

type DesktopProps = {
  rank: number;
  item: RankingItem;
  variant: Variant;
};

/** 桌面端：CSS Grid 一行，无 absolute，判断仅在内容轨 */
export function RankingTableRow({ rank, item, variant }: DesktopProps) {
  const jd = buildDisplayJudgment(item);
  const means = displayInsightSummary(item.what_it_means_for_you, item.what_happened);
  const aux = auxiliaryTitle(item, jd);
  const isTop = rank <= 3;
  const useMedals = variant === 'rankings';
  const eyebrow = jd.fromOneLiner ? 'AI Pulse 判断' : '摘要';

  const rowMin = isTop ? 'min-h-[96px]' : 'min-h-[72px]';
  const tierBg = isTop ? 'bg-slate-50/50' : '';

  const rowPad = isTop ? 'py-2.5' : 'py-1.5';

  return (
    <div
      className={`ranking-table-grid border-b border-slate-100 px-2 transition-colors last:border-b-0 hover:bg-slate-50/80 md:px-3 ${rowPad} ${rowMin} ${tierBg}`}
      role="row"
    >
      <div className="flex h-full items-center justify-center" role="cell">
        {useMedals ? (
          <RankMedal rank={rank} />
        ) : (
          <RankHomeNumeric rank={rank} emphasis={isTop} />
        )}
      </div>

      <div className="flex h-full items-center justify-start" role="cell">
        <PulseScoreCell score={item.ranking_score} compact />
      </div>

      <div className="flex min-h-0 flex-col justify-center gap-1 py-1" role="cell">
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

      <div className="flex h-full items-center" role="cell">
        <p className="text-[0.8125rem] leading-snug text-slate-600 [overflow-wrap:anywhere] line-clamp-2">{means}</p>
      </div>

      <div className="flex h-full items-center justify-center" role="cell">
        <span className="inline-flex max-w-full rounded-md border border-primary/15 bg-primary/[0.06] px-1.5 py-0.5 text-center text-[0.65rem] font-medium leading-tight text-primary">
          {categoryLabel(item.category)}
        </span>
      </div>

      <div className="flex h-full items-center text-[0.7rem] tabular-nums text-slate-500" role="cell">
        {formatRelativeTime(item.published_at)}
      </div>

      <div className="flex h-full items-center justify-end" role="cell">
        <RowActionLink item={item} />
      </div>
    </div>
  );
}

type MobileProps = {
  rank: number;
  item: RankingItem;
  variant: Variant;
};

/**
 * 移动端：四行栈 —— 排名+Pulse+分类 | 判断 | 原文 | 含义+操作
 * 紧凑，非大卡片流
 */
export function RankingTableMobileRow({ rank, item, variant }: MobileProps) {
  const jd = buildDisplayJudgment(item);
  const means = displayInsightSummary(item.what_it_means_for_you, item.what_happened);
  const aux = auxiliaryTitle(item, jd);
  const isTop = rank <= 3;
  const useMedals = variant === 'rankings';

  const rawTitleLine =
    item.title.trim() && item.title.trim() !== jd.text.trim() ? item.title.trim() : aux || '';

  return (
    <div
      className={`border-b border-slate-100 px-3 py-2 last:border-b-0 ${isTop ? 'bg-slate-50/40 py-2.5' : ''}`}
    >
      {/* 第一行：排名 + Pulse + 分类 */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2.5">
          <div className="flex min-h-[2.5rem] min-w-[2.75rem] items-center justify-center">
            {useMedals ? <RankMedal rank={rank} /> : <RankHomeNumeric rank={rank} emphasis={isTop} />}
          </div>
          <PulseScoreCell score={item.ranking_score} compact={!isTop} />
        </div>
        <span className="max-w-[10rem] truncate rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-600">
          {categoryLabel(item.category)}
        </span>
      </div>

      {/* 第二行：判断 */}
      <p
        className={`mt-1.5 font-headline font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] line-clamp-2 ${
          isTop ? 'text-[0.9rem]' : 'text-sm'
        }`}
      >
        {jd.text}
      </p>

      {/* 第三行：原始标题 */}
      {rawTitleLine ? (
        <p className="mt-0.5 text-xs leading-snug text-slate-500 [overflow-wrap:anywhere] line-clamp-1">
          {rawTitleLine}
        </p>
      ) : null}

      {/* 第四行：对你意味着什么 + 操作 */}
      <div className="mt-1.5 flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[0.7rem] leading-snug text-slate-600 [overflow-wrap:anywhere] line-clamp-2">
          {means}
        </p>
        <div className="shrink-0 pt-0.5">
          <RowActionLink item={item} />
        </div>
      </div>
    </div>
  );
}
