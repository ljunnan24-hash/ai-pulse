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
  /** full：详情卡片；compact：保留兼容；homeRow：首页紧凑列表 */
  variant?: 'compact' | 'full' | 'homeRow';
};

export function RankingCard({ rank, item, variant = 'full' }: Props) {
  const [copied, setCopied] = useState(false);
  const rankLabel = `#${String(rank).padStart(2, '0')}`;
  const { primary, secondary } = splitTitleForDisplay(item.title);
  const judgment = (item.one_liner ?? '').trim();
  const hasJudgmentLayout = Boolean(judgment);
  const whatLine = (item.what_happened || '').trim() || '—';
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

  const metaLine =
    variant === 'full' || variant === 'homeRow' ? (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-slate-500">
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-600">
          {categoryLabel(item.category)}
        </span>
        <span>来源 {item.source_count}</span>
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

  const scoreAction = hasJudgmentLayout ? (
    <div className="flex w-max shrink-0 flex-col items-end justify-start pt-0.5">
      <ScoreBadge score={item.ranking_score} variant="subtle" />
    </div>
  ) : (
    <div className="flex w-max max-w-[min(100%,11rem)] shrink-0 flex-col items-end gap-2 sm:max-w-none">
      <ScoreBadge score={item.ranking_score} variant="subtle" />
      <ActionBadge suggestion={item.action_suggestion} className="max-w-[12rem] whitespace-normal text-right sm:max-w-xs" />
    </div>
  );

  const judgmentHeroEl = (
    <div className="border-l-[3px] border-primary pl-3">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">AI Pulse 判断</span>
      <p className="mt-1.5 font-headline text-base font-semibold leading-snug text-slate-900 md:text-[1.05rem] [overflow-wrap:anywhere] break-words">
        {judgment}
      </p>
    </div>
  );

  const judgmentRestEl = (
    <>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-medium text-slate-400">原始标题</p>
        <p className="mt-1 text-xs leading-snug text-slate-500 line-clamp-2 [overflow-wrap:anywhere] break-words">
          {item.title}
        </p>
      </div>

      <div className="line-clamp-2 text-sm leading-relaxed text-slate-600">
        <span className="font-medium text-slate-800">{insightLabel}</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className="[overflow-wrap:anywhere] break-words font-normal">{insightParagraph}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">行动建议</span>
        <ActionBadge suggestion={item.action_suggestion} className="max-w-full sm:max-w-md" />
      </div>

      {metaLine}
    </>
  );

  const mainBlockJudgment = (
    <div className="min-w-0 space-y-3">
      {judgmentHeroEl}
      <div className="min-w-0 space-y-3">{judgmentRestEl}</div>
    </div>
  );

  const mainBlockLegacy = (
    <div className="min-w-0 space-y-2.5">
      <h3 className="line-clamp-2 font-headline text-base font-semibold leading-snug text-slate-900 group-hover:text-primary md:text-lg">
        {primary}
      </h3>
      {secondary ? (
        <p className="line-clamp-1 text-xs leading-snug text-slate-500">原文：{secondary}</p>
      ) : null}

      <div className="line-clamp-2 text-sm leading-relaxed text-slate-600">
        <span className="font-medium text-slate-700">发生了什么</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className="[overflow-wrap:anywhere] break-words">{whatLine}</span>
      </div>
      <div className="line-clamp-2 text-sm leading-relaxed text-slate-600">
        <span className="font-medium text-slate-800">对你意味着什么</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className="[overflow-wrap:anywhere] break-words">{meanLine}</span>
      </div>

      {metaLine}
    </div>
  );

  const mainBlock = hasJudgmentLayout ? mainBlockJudgment : mainBlockLegacy;

  const rankSize =
    variant === 'homeRow'
      ? 'text-lg md:text-xl'
      : variant === 'full'
        ? 'text-2xl md:text-3xl'
        : 'text-3xl md:text-4xl';

  const rankBlock = (
    <span
      className={`font-headline font-bold tabular-nums leading-none text-primary ${rankSize} w-10 shrink-0 sm:w-11 md:text-left`}
    >
      {rankLabel}
    </span>
  );

  if (variant === 'homeRow') {
    return (
      <article className="card-surface group min-w-0 max-w-full overflow-hidden transition-colors hover:border-slate-300">
        <Link to={detailPath} className="block px-3 py-3.5 ring-inset md:px-4 md:py-4">
          <div className="flex flex-col gap-3">
            {hasJudgmentLayout ? (
              <p className="font-headline text-[0.95rem] font-semibold leading-snug text-slate-900 md:hidden [overflow-wrap:anywhere] break-words">
                {judgment}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1.5">
                {rankBlock}
                <ScoreBadge score={item.ranking_score} variant="subtle" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {hasJudgmentLayout ? (
                  <p className="hidden font-headline text-[0.95rem] font-semibold leading-snug text-slate-900 sm:block [overflow-wrap:anywhere] break-words">
                    {judgment}
                  </p>
                ) : (
                  <p className="font-headline text-[0.95rem] font-semibold leading-snug text-slate-900 line-clamp-2">{primary}</p>
                )}
                <p className="text-xs leading-snug text-slate-500 line-clamp-2 [overflow-wrap:anywhere] break-words">{item.title}</p>
                <p className="text-sm leading-relaxed text-slate-600 line-clamp-2 [overflow-wrap:anywhere] break-words">
                  <span className="font-medium text-slate-700">对你意味着什么</span>
                  <span className="text-slate-300"> · </span>
                  {meanLine}
                </p>
                <ActionBadge suggestion={item.action_suggestion} />
                <div className="flex flex-wrap items-center gap-2">{metaLine}</div>
              </div>
            </div>
          </div>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 md:px-4">
          <button
            type="button"
            onClick={copyEventLink}
            className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-primary hover:underline"
          >
            {copied ? '已复制链接' : '复制链接'}
          </button>
          <Link
            to={detailPath}
            className="text-xs font-semibold text-primary transition hover:underline"
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
      <div className="flex flex-col gap-3 md:hidden">
        {hasJudgmentLayout ? (
          <>
            {judgmentHeroEl}
            <div className="flex min-w-0 items-start justify-between gap-3">
              {rankBlock}
              {scoreAction}
            </div>
            <div className="min-w-0 space-y-3">{judgmentRestEl}</div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-start justify-between gap-3">
              {rankBlock}
              {scoreAction}
            </div>
            <div className="min-w-0">{mainBlockLegacy}</div>
          </>
        )}
      </div>

      <div className="hidden min-w-0 gap-4 md:grid md:grid-cols-[3rem_minmax(0,1fr)_auto] md:items-start">
        <div className="shrink-0 pt-0.5">{rankBlock}</div>
        <div className="min-w-0">{mainBlock}</div>
        {scoreAction}
      </div>
    </>
  );

  return (
    <article className="card-surface group min-w-0 max-w-full overflow-hidden transition-colors hover:border-slate-300">
      <Link
        to={detailPath}
        className="block px-4 pb-3 pt-3.5 ring-inset transition active:opacity-[0.99] md:px-5 md:pb-4 md:pt-4"
      >
        {cardInner}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 md:px-5 md:py-3">
        <button
          type="button"
          onClick={copyEventLink}
          className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-primary hover:underline"
        >
          {copied ? '已复制链接' : '复制链接'}
        </button>
        <Link
          to={detailPath}
          className="text-xs font-semibold text-primary transition group-hover:underline md:text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          查看详情 →
        </Link>
      </div>
    </article>
  );
}
