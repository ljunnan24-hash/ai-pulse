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
  const visible = rows.filter((g) => (g.term ?? '').trim() || (g.explain ?? '').trim());
  if (visible.length === 0) return null;

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {visible.map((g, i) => (
        <div
          key={`${g.term}-${i}`}
          className="rounded-[12px] border border-[#D8E2F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5"
        >
          <dt className="font-headline text-[15px] font-bold text-[#0F172A]">{g.term || '—'}</dt>
          <dd className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#64748B]">{clip(g.explain, 220)}</dd>
        </div>
      ))}
    </dl>
  );
}
