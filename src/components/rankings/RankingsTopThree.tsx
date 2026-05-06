import { Link } from 'react-router-dom';

import type { RankingItem } from './RankingCard';
import { briefWhatMeans, briefWhyWorth, firstSentences } from '../../lib/insightFallback';
import { categoryLabel } from '../../lib/categoryLabels';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

function RankMedal({ rank }: { rank: number }) {
  const medal = [
    'bg-gradient-to-b from-amber-200 to-amber-300 text-amber-950 ring-2 ring-amber-400/90 shadow-sm',
    'bg-gradient-to-b from-slate-100 to-slate-200 text-slate-800 ring-2 ring-slate-400/80 shadow-sm',
    'bg-gradient-to-b from-orange-200 to-orange-300 text-orange-950 ring-2 ring-orange-400/80 shadow-sm',
  ];
  return (
    <span
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums ${medal[rank - 1]}`}
    >
      {rank}
    </span>
  );
}

type Props = {
  items: RankingItem[];
};

/**
 * 信息榜单 Top3：大卡说明事实与价值；Pulse 弱化展示。
 */
export function RankingsTopThree({ items }: Props) {
  const top = items.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section className="mb-8 space-y-4" aria-label="榜单前三">
      <div>
        <h2 className="heading-section text-base md:text-lg">本榜最值得关注的 3 条信息</h2>
        <p className="mt-1 text-sm text-slate-600">先看标题与事实，再看价值；Pulse 仅作排序参考。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {top.map((item, idx) => {
          const rank = idx + 1;
          const split = splitTitleForDisplay(item.title);
          const rawWh = (item.what_happened ?? '').trim();
          const happened =
            firstSentences(item.what_happened, 2, 240) ||
            (rawWh.length > 0 ? rawWh.slice(0, 280) + (rawWh.length > 280 ? '…' : '') : '');
          const why = briefWhyWorth(item);
          const means = briefWhatMeans(item.what_it_means_for_you);
          const score = Number.isFinite(item.ranking_score) ? item.ranking_score.toFixed(1) : '—';

          return (
            <article
              key={item.id}
              className="flex min-h-[260px] flex-col rounded-[var(--radius-card)] border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <RankMedal rank={rank} />
                <div className="text-right">
                  <div className="text-[0.55rem] font-medium uppercase tracking-wide text-slate-400">Pulse（参考）</div>
                  <div className="font-headline text-lg font-semibold tabular-nums text-slate-500">{score}</div>
                </div>
              </div>

              <h3 className="mt-4 font-headline text-lg font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
                {split.primary}
              </h3>
              {split.secondary ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-500 [overflow-wrap:anywhere]">{split.secondary}</p>
              ) : null}

              <div className="mt-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">发生了什么</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                  {happened || '暂无摘要，请打开详情查看事实全文。'}
                </p>
              </div>
              {why ? (
                <div className="mt-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">为什么值得看</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">{why}</p>
                </div>
              ) : null}
              {means ? (
                <div className="mt-3 flex-1">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">对你意味着什么</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{means}</p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {categoryLabel(item.category)}
                </span>
                <span>{item.source_count ?? 0} 源</span>
                <span className="tabular-nums">{formatRelativeTime(item.published_at)}</span>
              </div>
              <Link
                to={`/events/${item.id}`}
                className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                查看详情 →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
