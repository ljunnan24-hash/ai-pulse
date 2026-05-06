import { ActionBadge } from '../common/ActionBadge';

export type NoiseRow = Record<string, string>;

type Props = {
  row: NoiseRow;
};

export function NoiseCard({ row }: Props) {
  return (
    <article className="card-surface border-slate-200/90 bg-slate-50/50 px-4 py-4 text-slate-700 md:px-5 md:py-5">
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
