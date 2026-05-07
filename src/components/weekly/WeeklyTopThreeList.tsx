import type { WeeklyLooseRow } from './weeklyPayloadUtils';
import {
  weeklyPulseDisplayScore,
  weeklyPulseMeaning,
  weeklyPulseTitleEn,
  weeklyPulseTitleZh,
  weeklyRowCategorySlug,
} from './weeklyPayloadUtils';
import { PulseRankingsTableLayout, type PulseRankingsTableRow } from '../pulse/PulseRankingsTableLayout';

/** 站内 `/events/:id` 仅支持数字 GlobalEvent id；从 event_id 或 related_event_ids 中取首个正整数 */
function resolveWeeklyNumericEventId(row: WeeklyLooseRow): number | null {
  const tryParse = (raw: string | undefined): number | null => {
    const s = (raw ?? '').trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  };

  const direct = tryParse(row.event_id);
  if (direct !== null) return direct;

  const rel = (row.related_event_ids ?? '').trim();
  if (!rel) return null;
  for (const part of rel.split(/[,，]/)) {
    const id = tryParse(part);
    if (id !== null) return id;
  }
  return null;
}

/**
 * 周报「本周最重要三件事」：**与排行榜页同一组件、同一栅格与样式**（{@link PulseRankingsTableLayout}）。
 * 数据：`getWeeklyTopThreeJudgments` → 归并候选 → `pickMergedWeeklyTopThree` 最多 3 条。
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-slate-500">本期暂无上榜条目。</p>;
  }

  const pulseRows: PulseRankingsTableRow[] = rows.map((row, i) => {
    const eid = resolveWeeklyNumericEventId(row);
    const hasEvent = eid !== null;
    const urlStr = (row.url ?? '').trim();

    return {
      key: `${row.title}-${i}`,
      rank: i + 1,
      score: weeklyPulseDisplayScore(row),
      titleZh: weeklyPulseTitleZh(row),
      titleEn: weeklyPulseTitleEn(row),
      meaning: weeklyPulseMeaning(row),
      categorySlug: weeklyRowCategorySlug(row),
      detailTo: eid !== null ? `/events/${eid}` : undefined,
      externalUrl: !hasEvent && urlStr ? urlStr : undefined,
    };
  });

  return <PulseRankingsTableLayout rows={pulseRows} />;
}
