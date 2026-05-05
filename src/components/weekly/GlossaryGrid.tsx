import type { GlossaryRow } from './weeklyPayloadUtils';

type Props = {
  rows: GlossaryRow[];
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function GlossaryGrid({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map((g, i) => (
        <div key={`${g.term}-${i}`} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <dt className="font-headline text-base font-bold text-slate-900">{g.term || '—'}</dt>
          <dd className="mt-2 text-sm leading-relaxed text-slate-600">{clip(g.explain, 50)}</dd>
        </div>
      ))}
    </dl>
  );
}
