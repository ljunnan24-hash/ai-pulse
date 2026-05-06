export type CategoryRecapRow = Record<string, unknown>;

type Props = {
  row: CategoryRecapRow;
};

export function CategoryRecapCard({ row }: Props) {
  const events = Array.isArray(row.representative_events) ? row.representative_events : [];
  const top = events.slice(0, 3).map((ev) => (typeof ev === 'string' ? ev : JSON.stringify(ev)));

  return (
    <article className="card-surface p-5 md:p-6">
      <h3 className="font-headline text-lg font-bold text-slate-900">{String(row.category ?? '').trim() || '—'}</h3>

      {row.trend ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">本周趋势</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{String(row.trend)}</p>
        </div>
      ) : null}

      {top.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">代表事件</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {top.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#005bc1]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.what_to_watch ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold text-slate-500">接下来关注什么</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">{String(row.what_to_watch)}</p>
        </div>
      ) : null}
    </article>
  );
}
