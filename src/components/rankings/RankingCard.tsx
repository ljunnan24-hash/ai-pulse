import { Link } from 'react-router-dom';
import type { RankingsResponse } from '../../api/public';
import { ActionBadge } from '../common/ActionBadge';
import { ScoreBadge } from '../common/ScoreBadge';
import { categoryLabel } from '../../lib/categoryLabels';
import { displayEventTitle, displayInsightSummary } from '../../lib/insightFallback';

export type RankingItem = RankingsResponse['items'][number];

type Props = {
  rank: number;
  item: RankingItem;
  /** 首页精简 / 排行榜完整 */
  variant?: 'compact' | 'full';
};

export function RankingCard({ rank, item, variant = 'full' }: Props) {
  const metaLine =
    variant === 'full' ? (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
          {categoryLabel(item.category)}
        </span>
        <span>{item.source_count} 条来源</span>
        <span className="text-slate-400">·</span>
        <span>{item.published_at ? new Date(item.published_at).toLocaleDateString('zh-CN') : '—'}</span>
        {item.score_delta !== 0 ? (
          <span className={item.score_delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
            Δ {item.score_delta.toFixed(1)}
          </span>
        ) : null}
      </div>
    ) : (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-md bg-slate-100 px-2 py-0.5">{categoryLabel(item.category)}</span>
      </div>
    );

  return (
    <Link
      to={`/events/${item.id}`}
      className="group block rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition hover:border-[#005bc1]/35 hover:shadow-[0_8px_24px_rgba(0,91,193,0.08)] md:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex shrink-0 items-start gap-3 md:block md:w-14">
          <span className="font-headline text-2xl font-black tabular-nums text-[#005bc1]/90 md:block md:text-center">
            {rank}
          </span>
          <ScoreBadge score={item.ranking_score} className="md:mt-2" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-headline text-lg font-bold leading-snug text-slate-900 group-hover:text-[#005bc1] md:text-xl">
            {displayEventTitle(item.title)}
          </h3>
          {variant === 'full' ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                <span className="font-medium text-slate-800">发生了什么：</span>
                {(item.what_happened || '').trim() || '—'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                <span className="font-medium text-slate-900">对你意味着什么：</span>
                {displayInsightSummary(item.what_it_means_for_you, item.what_happened)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">发生了什么：</span>
                {(item.what_happened || '').trim() || '—'}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-medium text-slate-900">对你意味着什么：</span>
                {displayInsightSummary(item.what_it_means_for_you, item.what_happened)}
              </p>
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ActionBadge suggestion={item.action_suggestion} />
          </div>
          {metaLine}
        </div>
      </div>
    </Link>
  );
}
