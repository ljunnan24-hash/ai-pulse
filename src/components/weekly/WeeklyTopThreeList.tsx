import type { WeeklyLooseRow } from './weeklyPayloadUtils';
import {
  weeklyPulseDisplayScore,
  weeklyPulseMeaning,
  weeklyPulseTitleEn,
  weeklyPulseTitleZh,
  weeklyRowCategorySlug,
} from './weeklyPayloadUtils';
import { PulseRankingsTableLayout, type PulseRankingsTableRow } from '../pulse/PulseRankingsTableLayout';

/**
 * 周报「本周最重要三件事」：与排行榜 / 首页 Top5 同一表格栅格与样式。
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-slate-500">本期暂无上榜条目。</p>;
  }

  const pulseRows: PulseRankingsTableRow[] = rows.map((row, i) => {
    const eid = row.event_id ? Number(row.event_id) : NaN;
    const hasEvent = Number.isFinite(eid) && eid > 0;
    const urlStr = (row.url ?? '').trim();

    return {
      key: `${row.title}-${i}`,
      rank: i + 1,
      rankPaddedTwoDigits: true,
      score: weeklyPulseDisplayScore(row),
      titleZh: weeklyPulseTitleZh(row),
      titleEn: weeklyPulseTitleEn(row),
      meaning: weeklyPulseMeaning(row),
      categorySlug: weeklyRowCategorySlug(row),
      detailTo: hasEvent ? `/events/${eid}` : undefined,
      externalUrl: !hasEvent && urlStr ? urlStr : undefined,
    };
  });

  return <PulseRankingsTableLayout rows={pulseRows} />;
}
