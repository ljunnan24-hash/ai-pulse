import { Link } from 'react-router-dom';

import type { WeeklyLooseRow } from './weeklyPayloadUtils';
import { weeklyPulseMeaning, weeklyPulseTitleEn, weeklyPulseTitleZh } from './weeklyPayloadUtils';
import {
  PulseRankEventTitles,
  PulseRankMeaningBlock,
  PulseRankRankBadge,
  PulseRankRowChevron,
} from '../pulse/PulseRankItem';

const rowCls =
  'group flex items-start gap-3 border-b border-[#E2E8F0] px-4 py-4 transition-colors last:border-b-0 hover:bg-slate-50/80 md:gap-4 md:px-5 md:py-5';

/**
 * 周报本周最重要三件事：与榜单 / 首页 Top5 同源的 Pulse 列表（周报 variant：双位序号、可无英文行）
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-slate-500">本期暂无上榜条目。</p>;
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#D8E2F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
      {rows.map((row, i) => {
        const titleZh = weeklyPulseTitleZh(row);
        const titleEn = weeklyPulseTitleEn(row);
        const meaning = weeklyPulseMeaning(row);
        const eid = row.event_id ? Number(row.event_id) : NaN;
        const hasEvent = Number.isFinite(eid) && eid > 0;
        const urlStr = (row.url ?? '').trim();

        const inner = (
          <>
            <PulseRankRankBadge rank={i + 1} paddedTwoDigits />
            <div className="min-w-0 flex-1 space-y-2">
              <PulseRankEventTitles titleZh={titleZh} titleEn={titleEn} />
              {meaning ? <PulseRankMeaningBlock text={meaning} /> : null}
            </div>
            <PulseRankRowChevron />
          </>
        );

        if (hasEvent) {
          return (
            <Link key={`${row.title}-${i}`} to={`/events/${eid}`} className={`${rowCls} no-underline`}>
              {inner}
            </Link>
          );
        }
        if (urlStr) {
          return (
            <a key={`${row.title}-${i}`} href={urlStr} target="_blank" rel="noreferrer" className={`${rowCls} no-underline`}>
              {inner}
            </a>
          );
        }
        return (
          <div key={`${row.title}-${i}`} className={`${rowCls} cursor-default`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
