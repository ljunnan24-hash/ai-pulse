import { ActionBadge } from '../common/ActionBadge';

export type NoiseRow = Record<string, string>;

type Props = {
  row: NoiseRow;
};

export function NoiseCard({ row }: Props) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-100/70 px-5 py-5 text-slate-700 shadow-inner md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <ActionBadge suggestion="可以忽略" />
      </div>
      <h3 className="mt-4 font-headline text-lg font-semibold text-slate-800">{row.name || '—'}</h3>
      {row.why_not_important ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">为什么不重要</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{row.why_not_important}</p>
        </div>
      ) : null}
      {row.recommendation ? (
        <p className="mt-4 text-xs font-medium text-slate-500">建议：{row.recommendation}</p>
      ) : (
        <p className="mt-4 text-xs font-medium text-slate-500">建议：可以忽略</p>
      )}
    </article>
  );
}
