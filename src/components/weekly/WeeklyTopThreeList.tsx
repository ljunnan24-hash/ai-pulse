import { useEffect, useMemo, useState } from 'react';

import { fetchEventDetail } from '../../api/public';
import type { WeeklyCategoryResolved } from '../../lib/weeklyCategoryDisplay';
import { resolveWeeklyCategoryDisplay } from '../../lib/weeklyCategoryDisplay';
import type { WeeklyLooseRow } from './weeklyPayloadUtils';
import {
  pickWeeklyCategoryRaw,
  weeklyPulseMeaning,
  weeklyPulseTitleEn,
  weeklyPulseTitleZh,
  weeklyTopThreeDisplayScore,
} from './weeklyPayloadUtils';
import { PulseRankingsTableLayout, type PulseRankingsTableRow } from '../pulse/PulseRankingsTableLayout';

/** 站内 `/events/:id` 仅接受正整数 GlobalEvent.id（导出供单测与调试）。 */
export function resolveWeeklyNumericEventId(row: WeeklyLooseRow): number | null {
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

function detailHrefForWeeklyRow(row: WeeklyLooseRow, eid: number | null): string | undefined {
  const raw = ((row as Record<string, string>).detail_url ?? '').trim();
  if (raw.startsWith('/')) return raw;
  if (eid !== null) return `/events/${eid}`;
  return undefined;
}

/**
 * 周报专用：合并 payload 行与详情 API 的分类原始串，解析为 slug + 中文 label。
 * 无可用分类时返回 null（对应 UI「未分类」pill，不使用「—」）。
 */
export function resolveWeeklyTopThreeCategory(
  row: WeeklyLooseRow,
  apiCategory?: string,
): WeeklyCategoryResolved | null {
  const raw = pickWeeklyCategoryRaw(row).trim() || (apiCategory ?? '').trim();
  if (!raw) return null;
  return resolveWeeklyCategoryDisplay(raw);
}

type EventPatch = { category: string; ranking_score: number };

/**
 * 周报 Top3：与排行榜同款表格样式（粗标题、摘要三行截断、分类 pill）。
 * 若 payload 缺分类/分数，对有合法 GlobalEvent.id 的行请求 `/api/events/:id` 补齐。
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  const [eventById, setEventById] = useState<Record<number, EventPatch>>({});

  const fetchIdsSig = useMemo(
    () =>
      [...new Set(rows.map((r) => resolveWeeklyNumericEventId(r)).filter((x): x is number => x !== null))]
        .sort((a, b) => a - b)
        .join(','),
    [rows],
  );

  useEffect(() => {
    const ids = fetchIdsSig
      ? fetchIdsSig
          .split(',')
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (ids.length === 0) {
      setEventById({});
      return;
    }

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const d = await fetchEventDetail(id);
            return [id, { category: d.category ?? '', ranking_score: d.ranking_score }] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<number, EventPatch> = {};
      for (const e of entries) {
        if (e) next[e[0]] = e[1];
      }
      setEventById(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchIdsSig]);

  if (rows.length === 0) {
    return <p className="text-[14px] text-slate-500">本期暂无上榜条目。</p>;
  }

  const pulseRows: PulseRankingsTableRow[] = rows.map((row, i) => {
    const eid = resolveWeeklyNumericEventId(row);
    const api = eid !== null ? eventById[eid] : undefined;

    const detailTo = detailHrefForWeeklyRow(row, eid);

    const weeklyCategoryResolved = resolveWeeklyTopThreeCategory(row, api?.category);

    return {
      key: `${row.title}-${i}`,
      rank: i + 1,
      score: weeklyTopThreeDisplayScore(row),
      titleZh: weeklyPulseTitleZh(row),
      titleEn: weeklyPulseTitleEn(row),
      meaning: weeklyPulseMeaning(row),
      /** 周报固定走 weeklyCategoryResolved 分支，禁止回落到 categoryLabel 的「—」 */
      weeklyCategoryResolved,
      categorySlug: weeklyCategoryResolved?.slug ?? '',
      detailTo,
      weeklyUi: true,
    };
  });

  return <PulseRankingsTableLayout rows={pulseRows} scoreColumnLabel="本周分" />;
}
