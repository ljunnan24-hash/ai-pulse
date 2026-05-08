import { Link } from 'react-router-dom';

import { IndustryTagPills } from '../pulse/PulseRankingsTableLayout';
import type { HomeRankingItem } from '../../lib/homeRankingsDisplay';
import {
  computeThreeMetrics,
  focusCardDate,
  gradeLabel,
  pulseDisplayScore,
  pulseEventTitleEn,
  pulseEventTitleZh,
} from '../../lib/homeRankingsDisplay';

function MetricIconFreshness() {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#3B82F6]">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 16l5-5 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 8h6v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function MetricIconHeat() {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#FFF7ED] text-[#F97316]">
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
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[#EFF6FF] text-[#2563EB]">
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
    <aside className="mx-auto w-full max-w-[470px] rounded-[24px] border border-[#D8E2F0] bg-white p-[28px] shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:mx-0 lg:w-[470px] lg:max-w-none lg:shrink-0">
      <div className="flex items-start justify-between gap-2">
        {/* 与榜单主标题同级黑体感：Manrope 800 + 略大字号，避免被浏览器默认变细 */}
        <h2 className="font-headline text-lg font-extrabold leading-snug tracking-[-0.02em] text-[#0F172A]">
          今日重点信息
        </h2>
        <time
          className="shrink-0 text-[13px] font-semibold tabular-nums text-[#94A3B8]"
          dateTime={item?.published_at ?? rankUpdatedAt ?? undefined}
        >
          {dateStr}
        </time>
      </div>

      {!loaded ? (
        <p className="mt-6 text-sm text-[#64748B]">加载中…</p>
      ) : !item ? (
        <p className="mt-6 text-sm text-[#64748B]">暂无榜单数据时，此处会在有数据后展示重点条目。</p>
      ) : (
        <>
          <div className="mt-3">
            <span className="inline-flex items-center rounded-full bg-[#EAF2FF] px-[9px] py-[5px] text-[12px] font-bold tabular-nums text-[#2563EB]">
              PULSE {pulse !== null && Number.isFinite(pulse) ? pulse.toFixed(1) : '—'}
            </span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-[17px] font-bold leading-snug text-[#0F172A] [overflow-wrap:anywhere] md:text-[18px]">
            {pulseEventTitleZh(item)}
          </h3>
          {pulseEventTitleEn(item) ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]">
              {pulseEventTitleEn(item)}
            </p>
          ) : null}
          {item.industry_tags && item.industry_tags.length > 0 ? (
            <IndustryTagPills tags={item.industry_tags.slice(0, 2)} />
          ) : null}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-2xl border border-[#E5ECF5] bg-white px-2 py-3 text-center md:min-h-[92px]">
              <MetricIconFreshness />
              <p className="mt-1.5 text-[12px] font-medium text-[#64748B]">新鲜度</p>
              <p className="mt-0.5 font-headline text-[24px] font-extrabold leading-none tabular-nums text-[#0F172A] md:text-[25px]">
                {m?.freshness ?? '—'}
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-none text-[#94A3B8]">{m ? gradeLabel(m.freshness) : ''}</p>
            </div>
            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-2xl border border-[#E5ECF5] bg-white px-2 py-3 text-center md:min-h-[92px]">
              <MetricIconHeat />
              <p className="mt-1.5 text-[12px] font-medium text-[#64748B]">热度</p>
              <p className="mt-0.5 font-headline text-[24px] font-extrabold leading-none tabular-nums text-[#0F172A] md:text-[25px]">
                {m?.heat ?? '—'}
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-none text-[#94A3B8]">{m ? gradeLabel(m.heat) : ''}</p>
            </div>
            <div className="flex min-h-[88px] flex-col items-center justify-center rounded-2xl border border-[#E5ECF5] bg-white px-2 py-3 text-center md:min-h-[92px]">
              <MetricIconUserValue />
              <p className="mt-1.5 text-[12px] font-medium text-[#64748B]">用户价值</p>
              <p className="mt-0.5 font-headline text-[24px] font-extrabold leading-none tabular-nums text-[#0F172A] md:text-[25px]">
                {m?.userValue ?? '—'}
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-none text-[#94A3B8]">{m ? gradeLabel(m.userValue) : ''}</p>
            </div>
          </div>

          <Link
            to={`/events/${item.id}`}
            className="mt-5 block border-t border-[#E5ECF5] pt-4 text-[15px] font-bold text-[#2563EB] hover:underline"
          >
            查看事件详情 →
          </Link>
        </>
      )}
    </aside>
  );
}
