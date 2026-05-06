import { Link } from 'react-router-dom';

import type { RankingItem } from './RankingCard';
import { briefWhatMeans, briefWhyWorth, firstSentences } from '../../lib/insightFallback';
import { categoryLabel } from '../../lib/categoryLabels';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

type Props = {
  items: RankingItem[];
  /** 第一条的排行名次（例如 Top3 之后从 4 开始） */
  rankOffset?: number;
};

/**
 * 信息榜单：每行以标题与事实为主，Pulse 弱化；含查看详情。
 */
export function RankingsInformationList({ items, rankOffset = 0 }: Props) {
  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        const rank = idx + 1 + rankOffset;
        const split = splitTitleForDisplay(item.title);
        const rawWh = (item.what_happened ?? '').trim();
        const happened =
          firstSentences(item.what_happened, 3, 320) ||
          (rawWh.length > 0 ? rawWh.slice(0, 360) + (rawWh.length > 360 ? '…' : '') : '');
        const why = briefWhyWorth(item);
        const means = briefWhatMeans(item.what_it_means_for_you);
        const pulse =
          typeof item.ranking_score === 'number' && Number.isFinite(item.ranking_score)
            ? item.ranking_score.toFixed(1)
            : '—';

        return (
          <article
            key={item.id}
            className="rounded-[var(--radius-card)] border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-card)] md:p-5"
          >
            <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 pb-3">
              <span className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-md bg-slate-100 font-headline text-sm font-bold tabular-nums text-slate-800">
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-headline text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] md:text-lg">
                  {split.primary}
                </h3>
                {split.secondary ? (
                  <p className="mt-1 text-sm text-slate-500 [overflow-wrap:anywhere]">{split.secondary}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end text-right">
                <span className="text-[0.55rem] font-medium uppercase tracking-wide text-slate-400">Pulse（参考）</span>
                <span className="font-headline text-sm font-semibold tabular-nums text-slate-500">{pulse}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="min-w-0 md:col-span-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">发生了什么</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                  {happened || '暂无摘要，请打开详情查看事实全文。'}
                </p>
              </div>
              <div className="min-w-0 md:col-span-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">为什么值得看</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">{why || '—'}</p>
              </div>
              <div className="min-w-0 md:col-span-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">对你意味着什么</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{means || '—'}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {categoryLabel(item.category)}
                </span>
                <span>{item.source_count ?? 0} 条来源</span>
                <span className="tabular-nums">{formatRelativeTime(item.published_at)}</span>
              </div>
              <Link to={`/events/${item.id}`} className="shrink-0 font-semibold text-primary hover:underline">
                查看详情 →
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
