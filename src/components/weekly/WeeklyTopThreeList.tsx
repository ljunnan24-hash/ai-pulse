import { resolveWeeklyCategoryDisplay } from '../../lib/weeklyCategoryDisplay';
import {
  pulseRankMeaningWeeklyFullCls,
  pulseRankTitleEnWeeklyCls,
  pulseRankTitleWeeklyZhCls,
} from '../pulse/PulseRankItem';
import type { WeeklyLooseRow } from './weeklyPayloadUtils';
import {
  pickWeeklyCategoryRaw,
  weeklyPulseDisplayScore,
  weeklyPulseMeaning,
  weeklyPulseTitleEn,
  weeklyPulseTitleZh,
} from './weeklyPayloadUtils';
import { PulseRankingsTableLayout, type PulseRankingsTableRow } from '../pulse/PulseRankingsTableLayout';

function resolveWeeklyExternalUrl(row: WeeklyLooseRow): string {
  const u = (row.url ?? '').trim();
  if (u) return u;
  return (
    (row.source_urls ?? '')
      .split(/\n/)
      .map((x) => x.trim())
      .find(Boolean) ?? ''
  );
}

/** 站内 `/events/:id` 仅接受正整数 GlobalEvent.id；禁止 `/events/undefined`、字符串占位 id */
function resolveWeeklyNumericEventId(row: WeeklyLooseRow): number | null {
  const tryParse = (raw: string | undefined): number | null => {
    const s = (raw ?? '').trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
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
 * 周报「本周最重要三件事」：与排行榜共用 {@link PulseRankingsTableLayout}，周报专用分类解析与操作文案。
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-slate-500">本期暂无上榜条目。</p>;
  }

  const pulseRows: PulseRankingsTableRow[] = rows.map((row, i) => {
    const eid = resolveWeeklyNumericEventId(row);
    const extUrl = resolveWeeklyExternalUrl(row);

    const detailTo = eid !== null ? `/events/${eid}` : undefined;
    const externalUrl = detailTo ? undefined : extUrl || undefined;

    const catRaw = pickWeeklyCategoryRaw(row).trim();
    const weeklyCategoryResolved = catRaw ? resolveWeeklyCategoryDisplay(catRaw) : null;

    return {
      key: `${row.title}-${i}`,
      rank: i + 1,
      score: weeklyPulseDisplayScore(row),
      titleZh: weeklyPulseTitleZh(row),
      titleEn: weeklyPulseTitleEn(row),
      meaning: weeklyPulseMeaning(row),
      categorySlug: '',
      weeklyCategoryResolved,
      weeklyUi: true,
      titleZhClassName: pulseRankTitleWeeklyZhCls,
      titleEnClassName: pulseRankTitleEnWeeklyCls,
      meaningClassName: pulseRankMeaningWeeklyFullCls,
      overflowHints: true,
      detailTo,
      externalUrl,
    };
  });

  return <PulseRankingsTableLayout rows={pulseRows} />;
}
