import { Link } from 'react-router-dom';

import type { HomeRankingItem } from '../../lib/homeRankingsDisplay';
import {
  chineseIntroHeadline,
  computeThreeMetrics,
  focusCardDate,
  gradeLabel,
  originalTitleLine,
  pulseDisplayScore,
} from '../../lib/homeRankingsDisplay';

function MetricIconFreshness() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 16l5-5 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 8h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function MetricIconHeat() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path
          d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 2-1 3-2 4 .3-3-1-6-4-8 .5 4-3 6-3 11 0 4 3 7 6 7z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function MetricIconUserValue() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </span>
  );
}

type Props = {
  item: HomeRankingItem | null;
  rankUpdatedAt: string | null;
  loaded: boolean;
};

export function TodayFocusCard({ item, rankUpdatedAt, loaded }: Props) {
  const dateStr = focusCardDate(item ?? undefined, rankUpdatedAt);
  const pulse = item ? pulseDisplayScore(item) : null;
  const m = item ? computeThreeMetrics(item) : null;

  return (
    <aside className="card-surface mx-auto w-full max-w-[26.25rem] rounded-2xl p-6 shadow-[var(--shadow-card)] lg:mx-0 lg:p-7">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-headline text-sm font-semibold text-slate-800">今日重点信息</h2>
        <time className="shrink-0 text-xs tabular-nums text-slate-400" dateTime={item?.published_at ?? rankUpdatedAt ?? undefined}>
          {dateStr}
        </time>
      </div>

      {!loaded ? (
        <p className="mt-8 text-sm text-slate-500">加载中…</p>
      ) : !item ? (
        <p className="mt-8 text-sm text-slate-600">暂无榜单数据时，此处会在有数据后展示重点条目。</p>
      ) : (
        <>
          <div className="mt-4">
            <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/5 px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-primary">
              PULSE {pulse !== null && Number.isFinite(pulse) ? pulse.toFixed(1) : '—'}
            </span>
          </div>
          <h3 className="mt-3 font-headline text-xl font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]">
            {chineseIntroHeadline(item)}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 [overflow-wrap:anywhere]">
            {originalTitleLine(item)}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-center">
              <div className="flex justify-center">
                <MetricIconFreshness />
              </div>
              <p className="mt-2 text-[0.65rem] font-medium text-slate-500">新鲜度</p>
              <p className="mt-1 font-headline text-lg font-bold tabular-nums text-slate-900">{m?.freshness ?? '—'}</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-500">{m ? gradeLabel(m.freshness) : ''}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-center">
              <div className="flex justify-center">
                <MetricIconHeat />
              </div>
              <p className="mt-2 text-[0.65rem] font-medium text-slate-500">热度</p>
              <p className="mt-1 font-headline text-lg font-bold tabular-nums text-slate-900">{m?.heat ?? '—'}</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-500">{m ? gradeLabel(m.heat) : ''}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-center">
              <div className="flex justify-center">
                <MetricIconUserValue />
              </div>
              <p className="mt-2 text-[0.65rem] font-medium text-slate-500">用户价值</p>
              <p className="mt-1 font-headline text-lg font-bold tabular-nums text-slate-900">{m?.userValue ?? '—'}</p>
              <p className="mt-0.5 text-[0.65rem] text-slate-500">{m ? gradeLabel(m.userValue) : ''}</p>
            </div>
          </div>

          <Link to={`/events/${item.id}`} className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">
            查看事件详情 →
          </Link>
        </>
      )}
    </aside>
  );
}
