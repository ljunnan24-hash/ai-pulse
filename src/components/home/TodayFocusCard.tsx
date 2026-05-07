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
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#3B82F6]">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 16l5-5 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 8h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function MetricIconHeat() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#F97316]">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
    <aside className="mx-auto w-full max-w-[26.25rem] rounded-[24px] border border-[#E5EDF8] bg-white p-[28px] shadow-[0_10px_30px_rgba(15,23,42,0.04)] lg:mx-0">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-headline text-[14px] font-semibold text-[#334155]">今日重点信息</h2>
        <time
          className="shrink-0 text-[14px] font-semibold tabular-nums text-[#94A3B8]"
          dateTime={item?.published_at ?? rankUpdatedAt ?? undefined}
        >
          {dateStr}
        </time>
      </div>

      {!loaded ? (
        <p className="mt-8 text-sm text-[#64748B]">加载中…</p>
      ) : !item ? (
        <p className="mt-8 text-sm text-[#64748B]">暂无榜单数据时，此处会在有数据后展示重点条目。</p>
      ) : (
        <>
          <div className="mt-4">
            <span className="inline-flex items-center rounded-full bg-[#EAF2FF] px-[10px] py-[6px] text-[13px] font-bold tabular-nums text-[#2563EB]">
              PULSE {pulse !== null && Number.isFinite(pulse) ? pulse.toFixed(1) : '—'}
            </span>
          </div>
          <h3 className="mt-3 font-headline text-[22px] font-extrabold leading-[1.35] text-[#0F172A] [overflow-wrap:anywhere]">
            {chineseIntroHeadline(item)}
          </h3>
          <p className="mt-2 line-clamp-2 text-[15px] font-normal leading-[1.65] text-[#64748B] [overflow-wrap:anywhere]">
            {originalTitleLine(item)}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#E9EEF7] bg-white p-4 text-center">
              <div className="flex justify-center">
                <MetricIconFreshness />
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#64748B]">新鲜度</p>
              <p className="mt-1 font-headline text-[28px] font-extrabold tabular-nums text-[#0F172A]">
                {m?.freshness ?? '—'}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-[#94A3B8]">{m ? gradeLabel(m.freshness) : ''}</p>
            </div>
            <div className="rounded-2xl border border-[#E9EEF7] bg-white p-4 text-center">
              <div className="flex justify-center">
                <MetricIconHeat />
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#64748B]">热度</p>
              <p className="mt-1 font-headline text-[28px] font-extrabold tabular-nums text-[#0F172A]">{m?.heat ?? '—'}</p>
              <p className="mt-0.5 text-[12px] font-medium text-[#94A3B8]">{m ? gradeLabel(m.heat) : ''}</p>
            </div>
            <div className="rounded-2xl border border-[#E9EEF7] bg-white p-4 text-center">
              <div className="flex justify-center">
                <MetricIconUserValue />
              </div>
              <p className="mt-3 text-[13px] font-medium text-[#64748B]">用户价值</p>
              <p className="mt-1 font-headline text-[28px] font-extrabold tabular-nums text-[#0F172A]">
                {m?.userValue ?? '—'}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-[#94A3B8]">{m ? gradeLabel(m.userValue) : ''}</p>
            </div>
          </div>

          <Link to={`/events/${item.id}`} className="mt-5 inline-flex text-[15px] font-bold text-[#2563EB] hover:underline">
            查看事件详情 →
          </Link>
        </>
      )}
    </aside>
  );
}
