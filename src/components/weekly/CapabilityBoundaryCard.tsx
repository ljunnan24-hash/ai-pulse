import { linesFromBoundaryField } from './weeklyPayloadUtils';

export type BoundaryRow = Record<string, unknown>;

function confidenceClass(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.includes('高')) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (s.includes('低')) return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-900';
}

type Props = {
  row: BoundaryRow;
};

export function CapabilityBoundaryCard({ row }: Props) {
  const canLines = linesFromBoundaryField(row.can_do);
  const cannotLines = linesFromBoundaryField(row.cannot_do);
  const conclusion = row.conclusion != null ? String(row.conclusion).trim() : '';

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_14px_rgba(15,23,42,0.06)] md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-headline text-lg font-bold leading-snug text-slate-900 md:text-xl">
          {String(row.question ?? '').trim() || '—'}
        </h3>
        {row.confidence ? (
          <span
            className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${confidenceClass(row.confidence)}`}
          >
            置信 {String(row.confidence)}
          </span>
        ) : null}
      </div>

      {conclusion ? (
        <div className="mt-5 rounded-xl border border-[#005bc1]/25 bg-[#e8f4fc] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#004291]">结论</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900 md:text-[0.95rem]">{conclusion}</p>
        </div>
      ) : null}

      {(canLines.length > 0 || cannotLines.length > 0) && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {canLines.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">已经能做到</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {canLines.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 font-semibold text-emerald-600">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {cannotLines.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">还做不到</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {cannotLines.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 font-semibold text-rose-500">×</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {row.best_for ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">适合谁</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{String(row.best_for)}</p>
        </div>
      ) : null}

      {row.recommendation ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">建议</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">{String(row.recommendation)}</p>
        </div>
      ) : null}
    </article>
  );
}
