import { Link, useLocation } from 'react-router-dom';
import { eventDrawerHref } from '../../lib/eventDrawerLink';

export type JudgmentRow = Record<string, string>;

type Props = {
  rank: number;
  row: JudgmentRow;
};

function pulseScore(row: JudgmentRow): number {
  const n = Number(row.pulse_score);
  return Number.isFinite(n) ? n : 0;
}

function themeTag(row: JudgmentRow): string {
  const t = row.theme || row.category || row.judgment_theme || row.tag;
  return typeof t === 'string' ? t.trim() : '';
}

function firstEventId(row: JudgmentRow): number | null {
  const eid = row.event_id;
  if (eid && /^\d+$/.test(String(eid))) return parseInt(String(eid), 10);
  const raw = row.related_event_ids;
  if (!raw) return null;
  try {
    const j = JSON.parse(String(raw));
    if (Array.isArray(j) && j.length > 0 && /^\d+$/.test(String(j[0]))) {
      return parseInt(String(j[0]), 10);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function summaryLines(row: JudgmentRow): string {
  const w = (row.what_happened ?? '').trim();
  if (w) return w;
  const j = (row.judgment ?? row.one_liner ?? '').trim();
  return j;
}

/**
 * 目标稿：单容器内的紧凑行 — 蓝底名次块 + Pulse + 标题/摘要 + 分类 pill + 详情
 *（非独立大卡、无左侧粗边框「含义」框、不展开完整 URL）
 */
export function TopJudgmentRow({ rank, row }: Props) {
  const location = useLocation();
  const pulse = pulseScore(row);
  const tag = themeTag(row);
  const summary = summaryLines(row);
  const eventId = firstEventId(row);
  const detailHref = eventId != null ? eventDrawerHref(location.pathname, location.search, eventId) : null;

  return (
    <div className="border-b border-slate-100 bg-white last:border-b-0">
      {/* 桌面：四栏栅格 */}
      <div className="hidden gap-4 px-4 py-4 md:grid md:grid-cols-[56px_88px_minmax(0,1fr)_minmax(5rem,auto)] md:items-center md:gap-x-5 md:px-6 md:py-4 lg:grid-cols-[64px_96px_minmax(0,1fr)_7.5rem]">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary font-headline text-lg font-bold tabular-nums text-white shadow-sm">
            {rank}
          </div>
        </div>

        <div className="flex flex-col justify-center leading-none">
          <span className="text-[0.55rem] font-medium uppercase tracking-wide text-slate-400">Pulse</span>
          {pulse > 0 ? (
            <span className="mt-1 font-headline text-xl font-bold tabular-nums text-primary">{pulse.toFixed(1)}</span>
          ) : (
            <span className="mt-1 text-sm font-semibold text-slate-400">—</span>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="font-headline text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] line-clamp-2">
            {(row.title || '').trim() || '—'}
          </h3>
          {summary ? (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 [overflow-wrap:anywhere] line-clamp-2">
              {summary}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end justify-center gap-2">
          {tag ? (
            <span className="inline-flex max-w-full rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-center text-[0.7rem] font-medium text-slate-700">
              {tag}
            </span>
          ) : (
            <span className="text-[0.65rem] text-slate-300">—</span>
          )}
          {detailHref ? (
            <Link to={detailHref} className="text-xs font-semibold text-primary hover:underline">
              查看详情 →
            </Link>
          ) : null}
        </div>
      </div>

      {/* 移动端：纵向紧凑栈 */}
      <div className="px-3 py-3 md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary font-headline text-base font-bold text-white">
              {rank}
            </div>
            <div>
              <span className="text-[0.55rem] font-medium uppercase text-slate-400">Pulse</span>
              {pulse > 0 ? (
                <div className="font-headline text-lg font-bold tabular-nums text-primary">{pulse.toFixed(1)}</div>
              ) : (
                <div className="text-sm text-slate-400">—</div>
              )}
            </div>
          </div>
          {tag ? (
            <span className="max-w-[40%] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-700">
              {tag}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 font-headline text-sm font-semibold leading-snug text-slate-900 line-clamp-3 [overflow-wrap:anywhere]">
          {(row.title || '').trim() || '—'}
        </h3>
        {summary ? (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-slate-500 line-clamp-2 [overflow-wrap:anywhere]">
            {summary}
          </p>
        ) : null}
        {detailHref ? (
          <div className="mt-2 flex justify-end">
            <Link to={detailHref} className="text-xs font-semibold text-primary hover:underline">
              查看详情 →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}