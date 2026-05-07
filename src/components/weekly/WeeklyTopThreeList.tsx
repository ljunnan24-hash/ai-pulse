import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import type { WeeklyLooseRow } from './weeklyPayloadUtils';

function rowSubtitle(row: WeeklyLooseRow): string {
  const w = (row.why_important ?? '').trim();
  if (w) return w.length > 160 ? `${w.slice(0, 160)}…` : w;
  const h = (row.what_happened ?? '').trim();
  if (h) return h.length > 160 ? `${h.slice(0, 160)}…` : h;
  const m = (row.what_it_means_for_you ?? '').trim();
  if (m) return m.length > 160 ? `${m.slice(0, 160)}…` : m;
  return '';
}

const NUMS = ['01', '02', '03'];

/**
 * 排行榜式三行列表：整行可点进事件详情；样式对齐站内榜单列表气质。
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-[#64748B]">本期暂无上榜条目。</p>;
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-[#D8E2F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {rows.map((row, i) => {
        const sub = rowSubtitle(row);
        const eid = row.event_id ? Number(row.event_id) : NaN;
        const hasEvent = Number.isFinite(eid) && eid > 0;
        const urlStr = (row.url ?? '').trim();

        const body = (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] font-headline text-[15px] font-extrabold tabular-nums text-[#2563EB]">
              {NUMS[i] ?? String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-headline text-[15px] font-bold leading-snug text-[#0F172A] [overflow-wrap:anywhere] md:text-[16px]">{row.title}</p>
              {sub ? (
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#64748B]">{sub}</p>
              ) : null}
            </div>
            <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[#64748B]">
              <span className="hidden sm:inline">查看详情</span>
              <ChevronRight className="h-4 w-4 text-[#94A3B8] transition group-hover:text-[#2563EB]" aria-hidden />
            </span>
          </>
        );

        const rowCls =
          'group flex items-start gap-3 border-b border-[#E2E8F0] px-4 py-4 transition-colors last:border-b-0 hover:bg-[#F8FAFC] md:gap-4 md:px-5 md:py-[18px]';

        if (hasEvent) {
          return (
            <Link key={`${row.title}-${i}`} to={`/events/${eid}`} className={`${rowCls} no-underline`}>
              {body}
            </Link>
          );
        }
        if (urlStr) {
          return (
            <a key={`${row.title}-${i}`} href={urlStr} target="_blank" rel="noreferrer" className={`${rowCls} no-underline`}>
              {body}
            </a>
          );
        }
        return (
          <div key={`${row.title}-${i}`} className={`${rowCls} cursor-default`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
