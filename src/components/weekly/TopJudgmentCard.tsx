import { Link } from 'react-router-dom';

import { ActionBadge } from '../common/ActionBadge';

export type JudgmentRow = Record<string, string>;

type Props = {
  rank: number;
  row: JudgmentRow;
};

function pulseScore(row: JudgmentRow): number {
  const n = Number(row.pulse_score);
  return Number.isFinite(n) ? n : 0;
}

function parseUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j.map(String).filter(Boolean);
  } catch {
    /* ignore */
  }
  return s.split(/[\s,]+/).filter((u) => /^https?:\/\//i.test(u));
}

function whyImportant(row: JudgmentRow): string | undefined {
  const v = row.why_it_matters || row['why_important'];
  return typeof v === 'string' ? v : undefined;
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

export function TopJudgmentCard({ rank, row }: Props) {
  const pulse = pulseScore(row);
  const urls = parseUrls(row.source_urls);
  const tag = themeTag(row);
  const why = whyImportant(row);
  const eventId = firstEventId(row);

  const detailHref = eventId != null ? `/events/${eventId}` : urls[0] || null;

  return (
    <article className="card-surface p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-center sm:gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-xl font-bold tabular-nums text-white shadow-sm">
            {rank}
          </div>
          {pulse > 0 ? (
            <div className="text-left sm:text-center">
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-slate-500">Pulse</span>
              <div className="font-headline text-lg font-bold tabular-nums text-primary">{pulse.toFixed(1)}</div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="font-headline text-lg font-semibold leading-snug text-slate-900 md:text-[1.125rem]">
              {row.title || '—'}
            </h3>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {tag ? (
                <span className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {tag}
                </span>
              ) : null}
              {row.action_level ? <ActionBadge suggestion={row.action_level} /> : null}
            </div>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-slate-700">
            {row.what_happened ? (
              <p className="[overflow-wrap:anywhere] break-words line-clamp-4 md:line-clamp-[5]">{row.what_happened}</p>
            ) : null}
            {why ? (
              <p className="border-l-2 border-primary/20 pl-3 text-slate-700 [overflow-wrap:anywhere] break-words">
                <span className="font-medium text-slate-800">对你意味着什么：</span>
                {why}
              </p>
            ) : null}
            {row.who_should_care ? (
              <p className="text-xs text-slate-600">
                <span className="font-medium text-slate-700">谁应关注：</span>
                {row.who_should_care}
              </p>
            ) : null}
            {row.what_to_do_now ? (
              <p className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-800">
                {row.what_to_do_now}
              </p>
            ) : null}
          </div>

          {urls.length > 0 ? (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">参考来源</p>
              <ul className="mt-2 space-y-1.5">
                {urls.slice(0, 3).map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noreferrer" className="break-all text-xs text-primary hover:underline">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detailHref ? (
            <div className="flex justify-end border-t border-slate-100 pt-3">
              {eventId != null ? (
                <Link to={detailHref} className="text-xs font-semibold text-primary hover:underline md:text-sm">
                  查看详情 →
                </Link>
              ) : (
                <a href={detailHref} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline md:text-sm">
                  查看详情 →
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
