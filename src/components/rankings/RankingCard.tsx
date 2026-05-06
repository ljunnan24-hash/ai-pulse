import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { RankingsResponse } from '../../api/public';
import { ActionBadge } from '../common/ActionBadge';
import { ScoreBadge } from '../common/ScoreBadge';
import { categoryLabel } from '../../lib/categoryLabels';
import { displayInsightSummary } from '../../lib/insightFallback';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

export type RankingItem = RankingsResponse['items'][number];

type Props = {
  rank: number;
  item: RankingItem;
  variant?: 'compact' | 'full' | 'homeRow';
};

/** 判断优先：one_liner → why_important → means → happened → title（标题兜底弱化排版） */
export function buildDisplayJudgment(item: RankingItem): {
  text: string;
  fromOneLiner: boolean;
  isTitleFallback: boolean;
} {
  const one = (item.one_liner ?? '').trim();
  if (one) return { text: one, fromOneLiner: true, isTitleFallback: false };
  const why = (item.why_important ?? '').trim();
  if (why) return { text: why, fromOneLiner: false, isTitleFallback: false };
  const means = (item.what_it_means_for_you ?? '').trim();
  if (means) return { text: means, fromOneLiner: false, isTitleFallback: false };
  const happened = (item.what_happened ?? '').trim();
  if (happened) return { text: happened, fromOneLiner: false, isTitleFallback: false };
  const { primary } = splitTitleForDisplay(item.title);
  if (primary.trim()) return { text: primary.trim(), fromOneLiner: false, isTitleFallback: true };
  return { text: (item.title || '').trim() || '—', fromOneLiner: false, isTitleFallback: true };
}

export function RankingCard({ rank, item, variant = 'full' }: Props) {
  const [copied, setCopied] = useState(false);
  const rankNum = String(rank).padStart(2, '0');
  const rankHash = `#${rankNum}`;
  const { text: displayJudgment, fromOneLiner, isTitleFallback } = buildDisplayJudgment(item);
  const eyebrow = fromOneLiner ? 'AI Pulse 判断' : '事件摘要';

  const meanLine = displayInsightSummary(item.what_it_means_for_you, item.what_happened);
  const meansRaw = (item.what_it_means_for_you || '').trim();
  const whyImportantRaw = (item.why_important ?? '').trim();
  const happenedRaw = (item.what_happened || '').trim();

  let insightLabel: string;
  let insightParagraph: string;
  if (whyImportantRaw) {
    insightLabel = '为什么重要';
    insightParagraph = whyImportantRaw;
  } else if (meansRaw) {
    insightLabel = '对你意味着什么';
    insightParagraph = meansRaw;
  } else if (happenedRaw) {
    insightLabel = '发生了什么';
    insightParagraph = happenedRaw;
  } else {
    insightLabel = '对你意味着什么';
    insightParagraph = '—';
  }

  const insightDuplicate =
    insightParagraph.trim() === displayJudgment.trim() || insightParagraph === '—';

  const detailPath = `/events/${item.id}`;

  const copyEventLink = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${detailPath}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const metaCompact =
    variant === 'full' || variant === 'homeRow' ? (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.65rem] leading-tight text-slate-500">
        <span className="rounded border border-slate-200/90 bg-slate-50 px-1 py-px font-medium text-slate-600">
          {categoryLabel(item.category)}
        </span>
        <span>{item.source_count} 源</span>
        <span className="text-slate-300">·</span>
        <span>{item.published_at ? new Date(item.published_at).toLocaleDateString('zh-CN') : '—'}</span>
        {item.score_delta !== 0 ? (
          <>
            <span className="text-slate-300">·</span>
            <span className={item.score_delta > 0 ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>
              Δ{item.score_delta > 0 ? '+' : ''}
              {item.score_delta.toFixed(1)}
            </span>
          </>
        ) : null}
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.7rem] font-medium text-slate-600">
          {categoryLabel(item.category)}
        </span>
        <span>来源 {item.source_count} 个</span>
      </div>
    );

  const scoreAction = (
    <div className="flex w-max shrink-0 flex-col items-end justify-start pt-0.5">
      <ScoreBadge score={item.ranking_score} variant="subtle" />
    </div>
  );

  /** 主判断区：左侧细线 + 眉标 + 粗体句（无重边框盒子） */
  const judgmentMainEl = (
    <div className="min-w-0 border-l-2 border-primary/35 pl-2.5">
      <span className="text-[0.6rem] font-medium uppercase tracking-wide text-slate-500">{eyebrow}</span>
      <p
        className={`mt-0.5 font-headline leading-snug text-slate-900 [overflow-wrap:anywhere] break-words md:text-[0.95rem] ${
          isTitleFallback
            ? 'line-clamp-4 text-[0.85rem] font-medium text-slate-800 md:line-clamp-6 md:text-base'
            : 'line-clamp-5 text-sm font-semibold md:line-clamp-8 md:font-semibold'
        }`}
      >
        {displayJudgment}
      </p>
    </div>
  );

  const auxiliaryBlock = (
    <>
      <p className="text-[0.7rem] leading-snug text-slate-500 line-clamp-1 [overflow-wrap:anywhere]">
        <span className="text-slate-400">原始标题 · </span>
        {item.title}
      </p>
      {!insightDuplicate ? (
        <p className="line-clamp-2 text-[0.8rem] leading-snug text-slate-600">
          <span className="font-medium text-slate-700">{insightLabel}</span>
          <span className="text-slate-300"> · </span>
          <span className="[overflow-wrap:anywhere] break-words">{insightParagraph}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionBadge suggestion={item.action_suggestion} className="max-w-[14rem] sm:max-w-md" />
      </div>
      {metaCompact}
    </>
  );

  const rankBlockFull = (
    <span className="w-9 shrink-0 pt-0.5 font-headline text-lg font-bold tabular-nums leading-none text-primary/90 md:w-10 md:text-xl">
      {rankHash}
    </span>
  );

  if (variant === 'homeRow') {
    return (
      <article className="group border-b border-slate-200 bg-white/90 last:border-b-0 hover:bg-slate-50/80">
        <Link to={detailPath} className="block px-2 py-2 md:px-3 md:py-2">
          <div className="flex gap-2 md:gap-3">
            <div className="flex shrink-0 flex-col items-start gap-1">
              <span className="font-headline text-[0.7rem] font-semibold tabular-nums text-primary/80">{rankNum}</span>
              <ScoreBadge score={item.ranking_score} variant="micro" />
            </div>
            <div className="min-w-0 flex-1 border-l border-primary/25 pl-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="text-[0.6rem] font-medium text-slate-500">{eyebrow}</span>
              </div>
              <p
                className={`mt-0.5 font-headline leading-[1.35] text-slate-900 line-clamp-2 [overflow-wrap:anywhere] md:text-sm ${
                  isTitleFallback ? 'text-[0.78rem] font-medium text-slate-800' : 'text-[0.8rem] font-semibold'
                }`}
              >
                {displayJudgment}
              </p>
              <p className="mt-1 text-[0.65rem] leading-tight text-slate-500 line-clamp-1 [overflow-wrap:anywhere]">
                {item.title}
              </p>
              {!insightDuplicate ? (
                <p className="mt-0.5 line-clamp-2 text-[0.65rem] leading-snug text-slate-600">
                  <span className="text-slate-500">对你意味着什么 · </span>
                  {meanLine}
                </p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ActionBadge suggestion={item.action_suggestion} />
              </div>
            </div>
          </div>
        </Link>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100/90 px-2 py-1 md:px-3">
          <button
            type="button"
            onClick={copyEventLink}
            className="text-[0.65rem] font-medium text-slate-500 underline-offset-2 hover:text-primary hover:underline"
          >
            {copied ? '已复制' : '复制链接'}
          </button>
          <Link
            to={detailPath}
            className="text-[0.65rem] font-semibold text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            查看详情 →
          </Link>
        </div>
      </article>
    );
  }

  const cardInner = (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        <div className="flex min-w-0 items-start gap-2">
          {rankBlockFull}
          <div className="min-w-0 flex-1">{judgmentMainEl}</div>
          {scoreAction}
        </div>
        <div className="min-w-0 space-y-2 pl-0">{auxiliaryBlock}</div>
      </div>

      <div className="hidden min-w-0 gap-3 md:grid md:grid-cols-[2.75rem_minmax(0,1fr)_auto] md:items-start">
        <div className="shrink-0">{rankBlockFull}</div>
        <div className="min-w-0 space-y-2">
          {judgmentMainEl}
          {auxiliaryBlock}
        </div>
        {scoreAction}
      </div>
    </>
  );

  return (
    <article className="group max-w-full overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-colors hover:border-slate-300/90">
      <Link to={detailPath} className="block px-3 py-2.5 ring-inset md:px-4 md:py-3">
        {cardInner}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5 md:px-4 md:py-2">
        <button
          type="button"
          onClick={copyEventLink}
          className="text-[0.65rem] font-medium text-slate-500 underline-offset-2 transition hover:text-primary hover:underline md:text-xs"
        >
          {copied ? '已复制链接' : '复制链接'}
        </button>
        <Link
          to={detailPath}
          className="text-xs font-semibold text-primary transition group-hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          查看详情 →
        </Link>
      </div>
    </article>
  );
}
