import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchArchive } from '../api/public';

export default function ArchivePage() {
  const [items, setItems] = useState<Array<{ report_date: string; title: string; weekly_url: string }>>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchArchive(52)
      .then((r) => setItems(r.items))
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto pt-8 pb-20">
      <h1 className="font-headline font-extrabold text-4xl text-on-surface mb-2">历史周报</h1>
      <p className="text-on-surface-variant mb-8">站内 SPA 渲染（JSON）；亦可打开外链 HTML 版本。</p>

      {err ? <p className="text-red-600 text-sm">{err}</p> : null}

      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.report_date}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-low px-5 py-4"
          >
            <div>
              <Link to={`/weekly/${it.report_date}`} className="font-headline font-bold text-lg text-on-surface hover:text-primary">
                {it.title}
              </Link>
              <p className="text-xs text-on-surface-variant mt-1">{it.report_date}</p>
            </div>
            {it.weekly_url ? (
              <a href={it.weekly_url} target="_blank" rel="noreferrer" className="text-sm text-primary shrink-0">
                打开 HTML 版
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {!err && items.length === 0 ? (
        <p className="text-on-surface-variant text-sm mt-8">暂无归档。请先发布 weekly_reports。</p>
      ) : null}
    </div>
  );
}
