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
    <div className="mx-auto max-w-3xl pb-20 pt-6 md:pt-8">
      <h1 className="font-headline text-3xl font-extrabold text-slate-900 md:text-4xl">历史周报</h1>
      <p className="mt-3 text-slate-600">
        每期周报都是可复盘的<strong className="text-slate-800">判断资产</strong>：日期、标题与站内报告页。
      </p>

      {err ? <p className="mt-6 text-sm text-red-600">{err}</p> : null}

      <ul className="mt-10 space-y-4">
        {items.map((it) => (
          <li
            key={it.report_date}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{it.report_date}</p>
              <Link
                to={`/weekly/${it.report_date}`}
                className="mt-1 block font-headline text-lg font-bold text-slate-900 hover:text-[#005bc1]"
              >
                {it.title}
              </Link>
              <p className="mt-2 text-sm text-slate-500">一句话主判断见报告页顶部（Phase 3.5）</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                to={`/weekly/${it.report_date}`}
                className="inline-flex justify-center rounded-full bg-[#005bc1] px-5 py-2.5 text-sm font-bold text-white"
              >
                查看报告
              </Link>
              {it.weekly_url ? (
                <a href={it.weekly_url} target="_blank" rel="noreferrer" className="text-center text-xs text-[#005bc1] hover:underline">
                  HTML 版
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!err && items.length === 0 ? (
        <p className="mt-10 text-sm text-slate-600">暂无归档。请先发布 weekly_reports。</p>
      ) : null}
    </div>
  );
}
