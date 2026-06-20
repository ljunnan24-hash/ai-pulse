import { useEffect, useMemo, useState } from 'react';

import { fetchEventDetail } from '../../api/public';
import { weeklyTopThreeToPulseTableRow, type WeeklyTopThreeEventPatch } from '../../lib/weeklyTopThreeRankingRow';
import type { WeeklyLooseRow } from './weeklyPayloadUtils';
export { resolveWeeklyTopThreeCategory } from './weeklyPayloadUtils';
import { PulseRankingsTableLayout } from '../pulse/PulseRankingsTableLayout';

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
 * 周报 Top3：与日榜 / 首页 Top5 同款表格（来源 + 中英文标题 + 发生了什么）。
 * 分类与 industry_tags 对有 event_id 的行请求详情 API 补齐。
 */
export function WeeklyTopThreeList({ rows }: { rows: WeeklyLooseRow[] }) {
  const [eventById, setEventById] = useState<Record<number, WeeklyTopThreeEventPatch>>({});

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
            const primary = d.sources?.[0]?.source_name?.trim();
            return [
              id,
              {
                category: d.category ?? '',
                title: d.title ?? '',
                title_zh: d.title_zh ?? '',
                url: d.sources?.[0]?.url ?? '',
                primary_source_name: primary,
                what_happened: d.what_happened ?? '',
                what_it_means_for_you: d.what_it_means_for_you ?? '',
                industry_tags: d.industry_tags,
              },
            ] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<number, WeeklyTopThreeEventPatch> = {};
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

  const pulseRows = rows.map((row, i) => {
    const eid = resolveWeeklyNumericEventId(row);
    const api = eid !== null ? eventById[eid] : undefined;
    const detailTo = detailHrefForWeeklyRow(row, eid);
    if (eid === null) {
      return weeklyTopThreeToPulseTableRow(row, i + 1, 0, api, detailTo);
    }
    return weeklyTopThreeToPulseTableRow(row, i + 1, eid, api, detailTo);
  });

  return <PulseRankingsTableLayout rows={pulseRows} scoreColumnLabel="本周分" />;
}
