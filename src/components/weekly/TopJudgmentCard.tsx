import { ActionBadge } from '../common/ActionBadge';
import { ScoreBadge } from '../common/ScoreBadge';

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

const fieldBlock = (label: string, value: string | undefined, emphasize?: boolean) => {
  if (!value?.trim()) return null;
  return (
    <div className={emphasize ? 'rounded-xl border border-[#005bc1]/12 bg-white px-4 py-3' : ''}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1.5 text-sm leading-relaxed ${emphasize ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
};

export function TopJudgmentCard({ rank, row }: Props) {
  const pulse = pulseScore(row);
  const urls = parseUrls(row.source_urls);

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_14px_rgba(15,23,42,0.06)] md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <span className="font-headline text-lg font-black tabular-nums text-[#005bc1]">Rank {String(rank).padStart(2, '0')}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {pulse > 0 ? <ScoreBadge score={pulse} label="Pulse" /> : null}
          {row.action_level ? <ActionBadge suggestion={row.action_level} /> : null}
        </div>
      </div>

      <h3 className="mt-5 font-headline text-xl font-bold leading-snug text-slate-900 md:text-[1.35rem]">{row.title || '—'}</h3>

      <div className="mt-6 space-y-5">
        {fieldBlock('发生了什么', row.what_happened)}
        {fieldBlock('为什么重要', row.why_it_matters)}
        {fieldBlock('谁应该关注', row.who_should_care)}
        {fieldBlock('现在怎么做', row.what_to_do_now, true)}
      </div>

      {urls.length > 0 ? (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500">参考链接</p>
          <ul className="mt-2 space-y-1.5">
            {urls.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="break-all text-sm text-[#005bc1] hover:underline">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
