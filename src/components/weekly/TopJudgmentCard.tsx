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

function whyImportant(row: JudgmentRow): string | undefined {
  const v = row.why_it_matters || row['why_important'];
  return typeof v === 'string' ? v : undefined;
}

const bodyClass =
  'mt-3 text-base leading-[1.75] text-slate-700 [overflow-wrap:anywhere] whitespace-normal break-words md:leading-[1.8]';
const bodyEmClass =
  'mt-3 text-base leading-[1.75] font-medium text-slate-900 [overflow-wrap:anywhere] whitespace-normal break-words md:leading-[1.8]';

const fieldBlock = (label: string, value: string | undefined, emphasize?: boolean) => {
  if (!value?.trim()) return null;
  return (
    <div className={emphasize ? 'rounded-xl border border-[#005bc1]/12 bg-white px-5 py-4' : ''}>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className={emphasize ? bodyEmClass : bodyClass}>{value}</p>
    </div>
  );
};

export function TopJudgmentCard({ rank, row }: Props) {
  const pulse = pulseScore(row);
  const urls = parseUrls(row.source_urls);
  const rankMark = `#${String(rank).padStart(2, '0')}`;

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_14px_rgba(15,23,42,0.06)] md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
        <span className="font-headline text-3xl font-black tabular-nums leading-none text-[#005bc1]">{rankMark}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {row.action_level ? <ActionBadge suggestion={row.action_level} /> : null}
          {pulse > 0 ? <ScoreBadge score={pulse} label="Pulse" variant="pill" /> : null}
        </div>
      </div>

      <h3 className="mt-6 font-headline text-xl font-bold leading-snug text-slate-900 md:text-[1.35rem]">{row.title || '—'}</h3>

      <div className="mt-8 space-y-8">
        {fieldBlock('发生了什么', row.what_happened)}
        {fieldBlock('为什么重要', whyImportant(row))}
        {fieldBlock('谁应该关注', row.who_should_care)}
        {fieldBlock('现在怎么做', row.what_to_do_now, true)}
      </div>

      {urls.length > 0 ? (
        <div className="mt-8 border-t border-slate-100 pt-6">
          <p className="text-xs font-semibold text-slate-500">参考来源</p>
          <ul className="mt-3 space-y-2">
            {urls.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="break-all text-base text-[#005bc1] hover:underline">
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
