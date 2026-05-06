export type CategoryRecapRow = Record<string, unknown>;

type Props = {
  row: CategoryRecapRow;
};

export function CategoryRecapCard({ row }: Props) {
  const events = Array.isArray(row.representative_events) ? row.representative_events : [];
  const top = events.slice(0, 5).map((ev) => {
    if (typeof ev === 'string') return ev;
    if (ev && typeof ev === 'object' && 'title' in (ev as Record<string, unknown>)) {
      return String((ev as Record<string, unknown>).title ?? '').trim() || JSON.stringify(ev);
    }
    return JSON.stringify(ev);
  });

  return (
    <article className="card-surface p-5 md:p-6">
      <h3 className="font-headline text-lg font-bold text-slate-900">{String(row.category ?? '').trim() || '—'}</h3>

      {top.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">代表事件</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-800">
            {top.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#005bc1]" />
                <span className="[overflow-wrap:anywhere]">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.trend ? (
        <div className={top.length > 0 ? 'mt-6 border-t border-slate-100 pt-5' : 'mt-5'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">本周整理</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{String(row.trend)}</p>
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
