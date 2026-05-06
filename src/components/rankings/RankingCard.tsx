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
  /** 首页略紧凑 meta；布局与 full 一致 */
  variant?: 'compact' | 'full';
};

export function RankingCard({ rank, item, variant = 'full' }: Props) {
  const [copied, setCopied] = useState(false);
  const rankLabel = `#${String(rank).padStart(2, '0')}`;
  const { primary, secondary } = splitTitleForDisplay(item.title);
  const judgment = (item.one_liner ?? '').trim();
  const whatLine = (item.what_happened || '').trim() || '—';
  const meanLine = displayInsightSummary(item.what_it_means_for_you, item.what_happened);
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

  const rankSize = variant === 'full' ? 'text-4xl md:text-[2.5rem]' : 'text-3xl md:text-4xl';

  const metaLine =
    variant === 'full' ? (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[0.7rem] font-medium text-slate-600">
          {categoryLabel(item.category)}
        </span>
        <span>来源 {item.source_count} 个</span>
        <span className="text-slate-300">·</span>
        <span>{item.published_at ? new Date(item.published_at).toLocaleDateString('zh-CN') : '—'}</span>
        {item.score_delta !== 0 ? (
          <>
            <span className="text-slate-300">·</span>
            <span className={item.score_delta > 0 ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'}>
              分数变化 {item.score_delta > 0 ? '+' : ''}
              {item.score_delta.toFixed(1)}
            </span>
          </>
        ) : null}
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[0.7rem] font-medium text-slate-600">
          {categoryLabel(item.category)}
        </span>
        <span>来源 {item.source_count} 个</span>
      </div>
    );

  const scoreAction = (
    <div className="flex w-max max-w-[min(100%,11rem)] shrink-0 flex-col items-end gap-2 sm:max-w-none">
      <ScoreBadge score={item.ranking_score} variant="pill" />
      <ActionBadge suggestion={item.action_suggestion} className="max-w-[12rem] whitespace-normal text-right sm:max-w-xs" />
    </div>
  );

  const mainBlock = (
    <div className="min-w-0 space-y-3">
      <h3 className="line-clamp-2 font-headline text-lg font-bold leading-snug text-slate-900 group-hover:text-[#005bc1] md:text-xl">
        {primary}
      </h3>
      {secondary ? (
        <p className="line-clamp-1 text-xs leading-snug text-slate-500">原文标题：{secondary}</p>
      ) : null}

      {judgment ? (
        <p
          className="rounded-lg border border-[#005bc1]/25 bg-gradient-to-r from-[#e8f2fc] to-slate-50/90 px-3.5 py-2.5 text-sm font-semibold leading-snug tracking-tight text-[#002a5c] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] [overflow-wrap:anywhere] break-words"
          role="note"
        >
          {judgment}
        </p>
      ) : null}

      <div className="line-clamp-2 text-sm leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-800">发生了什么</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className="[overflow-wrap:anywhere] break-words">{whatLine}</span>
      </div>
      <div className="line-clamp-2 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">对你意味着什么</span>
        <span className="mx-1 text-slate-300">·</span>
        <span className="[overflow-wrap:anywhere] break-words">{meanLine}</span>
      </div>

      {metaLine}
    </div>
  );

  const rankBlock = (
    <span
      className={`font-headline font-black tabular-nums leading-none text-[#005bc1] ${rankSize} w-12 shrink-0 sm:w-14 md:text-left`}
    >
      {rankLabel}
    </span>
  );

  const cardInner = (
    <>
      {/* 移动端：第一行 Rank + Pulse/行动；第二行起正文 */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex min-w-0 items-start justify-between gap-4">
          {rankBlock}
          {scoreAction}
        </div>
        <div className="min-w-0">{mainBlock}</div>
      </div>

      {/* 桌面端：三列 Rank | 正文 | Pulse + 行动 */}
      <div className="hidden min-w-0 gap-5 md:grid md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:items-start">
        <div className="shrink-0 pt-0.5">{rankBlock}</div>
        <div className="min-w-0">{mainBlock}</div>
        {scoreAction}
      </div>
    </>
  );

  return (
    <article className="group min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_14px_rgba(15,23,42,0.06)] ring-1 ring-transparent transition hover:border-[#005bc1]/35 hover:shadow-[0_12px_32px_rgba(0,91,193,0.12)] hover:ring-[#005bc1]/20">
      <Link
        to={detailPath}
        className="block p-5 pb-4 ring-inset transition active:scale-[0.998] md:p-6 md:pb-5"
      >
        {cardInner}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 md:px-6 md:py-3.5">
        <button
          type="button"
          onClick={copyEventLink}
          className="text-xs font-semibold text-slate-500 underline-offset-4 transition hover:text-[#005bc1] hover:underline"
        >
          {copied ? '已复制链接' : '复制链接'}
        </button>
        <Link
          to={detailPath}
          className="text-sm font-bold text-[#005bc1] transition group-hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          查看详情 →
        </Link>
      </div>
    </article>
  );
}
