import { Link } from 'react-router-dom';

import type { RankingItem } from '../rankings/RankingCard';
import { briefWhatMeans, briefWhyWorth, firstSentences } from '../../lib/insightFallback';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

type Props = {
  items: RankingItem[];
};

/**
 * 首页主模块：信息优先 — 标题、事实摘要、价值点、对你意味着什么。
 */
export function HomeTopInfoCards({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const split = splitTitleForDisplay(item.title);
        const rawHappened = (item.what_happened ?? '').trim();
        const happened =
          firstSentences(item.what_happened, 2, 280) ||
          (rawHappened.length > 0 ? rawHappened.slice(0, 280) + (rawHappened.length > 280 ? '…' : '') : '');
        const why = briefWhyWorth(item);
        const means = briefWhatMeans(item.what_it_means_for_you);

        return (
          <article
            key={item.id}
            className="flex flex-col rounded-[var(--radius-card)] border border-slate-200/90 bg-white p-5 shadow-[var(--shadow-card)]"
          >
            <Link
              to={`/events/${item.id}`}
              className="font-headline text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] no-underline hover:text-primary"
            >
              {split.primary}
            </Link>
            {split.secondary ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]">{split.secondary}</p>
            ) : null}

            <div className="mt-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">发生了什么</p>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                {happened || '暂无摘要文案，请打开详情查看完整事实与来源。'}
              </p>
            </div>

            {why ? (
              <div className="mt-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">为什么值得看</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">{why}</p>
              </div>
            ) : null}

            {means ? (
              <div className="mt-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">对你意味着什么</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{means}</p>
              </div>
            ) : null}

            <div className="mt-auto border-t border-slate-100 pt-4">
              <Link to={`/events/${item.id}`} className="text-sm font-semibold text-primary hover:underline">
                查看详情 →
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
