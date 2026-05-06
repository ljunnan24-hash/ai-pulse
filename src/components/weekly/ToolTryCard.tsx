import { ActionBadge } from '../common/ActionBadge';
import { isAffirmativeNoise } from './weeklyPayloadUtils';

export type ToolRow = Record<string, string>;

type Props = {
  row: ToolRow;
};

function Pill({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'blue' }) {
  const cls =
    tone === 'blue'
      ? 'border-[#005bc1]/25 bg-[#005bc1]/8 text-[#004291]'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold ${cls}`}>{children}</span>
  );
}

export function ToolTryCard({ row }: Props) {
  const rec = (row.recommendation || '').trim();
  const showRecBadge = rec && !isAffirmativeNoise(rec);
  const barrier = (row.barrier || '').trim();
  const barrierLabel = barrier.startsWith('门槛') ? barrier : barrier ? `门槛：${barrier}` : '';

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-headline text-base font-bold leading-snug text-slate-900">{row.name || '—'}</h3>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {row.action_level ? <ActionBadge suggestion={row.action_level} /> : null}
        {barrierLabel ? <Pill>{barrierLabel}</Pill> : null}
        {showRecBadge ? <Pill tone="blue">{rec}</Pill> : null}
      </div>

      {row.what_it_does ? (
        <div className="mt-4 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">能做什么</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{row.what_it_does}</p>
        </div>
      ) : null}

      {row.best_for ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">适合谁</p>
          <p className="mt-1.5 text-sm text-slate-600">{row.best_for}</p>
        </div>
      ) : null}

      {row.url ? (
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block max-w-full break-all text-sm font-medium text-[#005bc1] hover:underline"
        >
          访问官网 →
        </a>
      ) : null}
    </article>
  );
}
