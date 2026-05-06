import { Link } from 'react-router-dom';

import type { WeeklyLooseRow } from './weeklyPayloadUtils';

type Props = {
  rank: number;
  row: WeeklyLooseRow;
};

function hostFromUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  try {
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function eventIdFromRow(row: WeeklyLooseRow): number | null {
  const eid = row.event_id;
  if (eid && /^\d+$/.test(String(eid))) return parseInt(String(eid), 10);
  return null;
}

/**
 * 周报「信息条目」：标题 + 事实 + 价值层 + 来源（名称优先）。
 */
export function WeeklyInfoDigestRow({ rank, row }: Props) {
  const detailId = eventIdFromRow(row);
  const detailHref = detailId != null ? `/events/${detailId}` : null;
  const srcName = (row.source_name || '').trim();
  const host = hostFromUrl(row.url || '');

  return (
    <article className="border-b border-slate-100 bg-white px-4 py-5 last:border-b-0 md:px-6 md:py-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 font-headline text-sm font-bold text-slate-800">
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-headline text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
            {(row.title || '').trim() || '—'}
          </h3>

          {(row.what_happened || '').trim() ? (
            <div className="mt-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">发生了什么</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">
                {String(row.what_happened ?? '').trim() || '—'}
              </p>
            </div>
          ) : null}

          {(row.why_important || '').trim() ? (
            <div className="mt-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">为什么值得看</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                {String(row.why_important ?? '').trim() || '—'}
              </p>
            </div>
          ) : null}

          {(row.what_it_means_for_you || '').trim() ? (
            <div className="mt-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">对你意味着什么</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
                {String(row.what_it_means_for_you ?? '').trim() || '—'}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            {srcName ? (
              <span>
                <span className="font-medium text-slate-600">来源</span> {srcName}
              </span>
            ) : host ? (
              <span>
                <span className="font-medium text-slate-600">来源站点</span> {host}
              </span>
            ) : null}
            {row.pulse_score && Number(row.pulse_score) > 0 ? (
              <span className="tabular-nums">Pulse {Number(row.pulse_score).toFixed(1)}</span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {detailHref ? (
              <Link to={detailHref} className="text-sm font-semibold text-primary hover:underline">
                查看详情 →
              </Link>
            ) : null}
            {(row.url || '').trim() ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-primary hover:underline"
              >
                打开原文链接
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
