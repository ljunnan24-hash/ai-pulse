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
 * 周报「本周最重要三件事」：**与排行榜页同一组件、同一栅格与样式**（{@link PulseRankingsTableLayout}）。
 * 数据：`getWeeklyTopThreeJudgments` → 归并候选 → `pickMergedWeeklyTopThree` 最多 3 条。
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-slate-500">本期暂无上榜条目。</p>;
  }

  const pulseRows: PulseRankingsTableRow[] = rows.map((row, i) => {
    let eid = row.event_id ? Number(row.event_id) : NaN;
    if (!Number.isFinite(eid) || eid <= 0) {
      const rel = (row.related_event_ids ?? '').trim();
      if (rel) {
        const first = rel.split(/[,，]/).map((x) => x.trim()).find(Boolean);
        const n = first ? Number(first) : NaN;
        if (Number.isFinite(n) && n > 0) eid = n;
      }
    }
    const hasEvent = Number.isFinite(eid) && eid > 0;
    const urlStr = (row.url ?? '').trim();

    return {
      key: `${row.title}-${i}`,
      rank: i + 1,
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
