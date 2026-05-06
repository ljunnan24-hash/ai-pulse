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
  /** 首页信号卡 / 排行榜完整 */
  variant?: 'compact' | 'full';
};

export function RankingCard({ rank, item, variant = 'full' }: Props) {
  const rankLabel = `#${String(rank).padStart(2, '0')}`;
  const { primary, secondary } = splitTitleForDisplay(item.title);
  const whatLine = (item.what_happened || '').trim() || '—';
  const meanLine = displayInsightSummary(item.what_it_means_for_you, item.what_happened);

  const metaLine =
    variant === 'full' ? (
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
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
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>来源 {item.source_count} 个</span>
      </div>
    );

  return (
    <Link
      to={`/events/${item.id}`}
      className="group block min-w-0 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_14px_rgba(15,23,42,0.06)] ring-1 ring-transparent transition hover:border-[#005bc1]/35 hover:shadow-[0_12px_32px_rgba(0,91,193,0.12)] hover:ring-[#005bc1]/20 active:scale-[0.998] md:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-start gap-3 sm:block sm:w-[4.5rem]">
          <span
            className={`font-headline font-black tabular-nums leading-none text-[#005bc1] ${
              variant === 'full' ? 'text-4xl tracking-tight' : 'text-3xl'
            }`}
          >
            {rankLabel}
          </span>
          <ScoreBadge score={item.ranking_score} variant="pill" className="sm:mt-3" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {categoryLabel(item.category)}
            </span>
            <ActionBadge suggestion={item.action_suggestion} />
          </div>

          <h3 className="mt-3 line-clamp-2 font-headline text-lg font-bold leading-snug text-slate-900 group-hover:text-[#005bc1] md:text-xl">
            {primary}
          </h3>
          {secondary ? (
            <p className="mt-1 line-clamp-1 text-xs leading-snug text-slate-500">原文标题：{secondary}</p>
          ) : null}

          <div className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">发生了什么</span>
            <span className="mx-1 text-slate-300">·</span>
            <span>{whatLine}</span>
          </div>
          <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">对你意味着什么</span>
            <span className="mx-1 text-slate-300">·</span>
            <span>{meanLine}</span>
          </div>

          {metaLine}

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-400">点击查看完整判断与评分依据</span>
            <span className="shrink-0 text-sm font-bold text-[#005bc1]">查看详情 →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
