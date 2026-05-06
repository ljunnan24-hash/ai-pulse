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
  const hasJudgmentLayout = Boolean(judgment);
  const whatLine = (item.what_happened || '').trim() || '—';
  const meanLine = displayInsightSummary(item.what_it_means_for_you, item.what_happened);
  const meansRaw = (item.what_it_means_for_you || '').trim();
  const whyImportantRaw = (item.why_important ?? '').trim();
  const happenedRaw = (item.what_happened || '').trim();
  /** 列表接口将来若返回 why_important，用「为什么重要」；当前默认与字段语义对齐 */
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

  /** 有 one_liner 时：右侧仅保留分数字段，避免与主判断抢视觉 */
  const scoreAction = hasJudgmentLayout ? (
    <div className="flex w-max shrink-0 flex-col items-end pt-1">
      <ScoreBadge score={item.ranking_score} variant="default" className="opacity-90" />
    </div>
  ) : (
    <div className="flex w-max max-w-[min(100%,11rem)] shrink-0 flex-col items-end gap-2 sm:max-w-none">
      <ScoreBadge score={item.ranking_score} variant="pill" />
      <ActionBadge suggestion={item.action_suggestion} className="max-w-[12rem] whitespace-normal text-right sm:max-w-xs" />
    </div>
  );

  const judgmentHeroEl = (
    <div className="rounded-xl border-2 border-[#005bc1]/35 bg-gradient-to-br from-[#e8f4fc] via-white to-slate-50/90 px-4 py-3.5 shadow-[0_4px_20px_rgba(0,91,193,0.08)] md:px-5 md:py-4">
      <span className="inline-flex items-center rounded-md bg-[#005bc1] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white">
        AI Pulse 判断
      </span>
      <p className="mt-3 font-headline text-lg font-extrabold leading-snug tracking-tight text-slate-950 md:text-xl [overflow-wrap:anywhere] break-words">
        {judgment}
      </p>
    </div>
  );

  const judgmentRestEl = (
    <>
      <div className="min-w-0">
        <p className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">原始标题</p>
        <p className="mt-1.5 text-sm font-medium leading-snug text-slate-700 line-clamp-3 [overflow-wrap:anywhere] break-words">
          {item.title}
        </p>
      </div>

      <div className="line-clamp-3 text-sm leading-relaxed text-slate-700">
        <span className="font-bold text-slate-900">{insightLabel}</span>
        <span className="mx-1.5 text-slate-300">·</span>
        <span className="[overflow-wrap:anywhere] break-words font-normal">{insightParagraph}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-bold text-slate-900">行动建议</span>
        <ActionBadge suggestion={item.action_suggestion} className="max-w-full sm:max-w-md" />
      </div>

      {metaLine}
    </>
  );

  const mainBlockJudgment = (
    <div className="min-w-0 space-y-4">
      {judgmentHeroEl}
      <div className="min-w-0 space-y-4">{judgmentRestEl}</div>
    </div>
  );

  const mainBlockLegacy = (
    <div className="min-w-0 space-y-3">
      <h3 className="line-clamp-2 font-headline text-lg font-bold leading-snug text-slate-900 group-hover:text-[#005bc1] md:text-xl">
        {primary}
      </h3>
      {secondary ? (
        <p className="line-clamp-1 text-xs leading-snug text-slate-500">原文标题：{secondary}</p>
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

  const mainBlock = hasJudgmentLayout ? mainBlockJudgment : mainBlockLegacy;

  const rankBlock = (
    <span
      className={`font-headline font-black tabular-nums leading-none text-[#005bc1] ${rankSize} w-12 shrink-0 sm:w-14 md:text-left`}
    >
      {rankLabel}
    </span>
  );

  const cardInner = (
    <>
      {/* 移动端：有判断句时首屏先展示 one_liner，再 Rank + Pulse，再其余 */}
      <div className="flex flex-col gap-4 md:hidden">
        {hasJudgmentLayout ? (
          <>
            {judgmentHeroEl}
            <div className="flex min-w-0 items-start justify-between gap-3">
              {rankBlock}
              {scoreAction}
            </div>
            <div className="min-w-0 space-y-4">{judgmentRestEl}</div>
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
