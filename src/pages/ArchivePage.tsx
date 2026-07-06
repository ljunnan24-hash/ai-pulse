import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchArchive } from '../api/public';
import { EmptyState } from '../components/common/EmptyState';
import { Seo, absoluteUrl } from '../components/Seo';

export default function ArchivePage() {
  const [items, setItems] = useState<Array<{ report_date: string; title: string; weekly_url: string }>>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchArchive(52)
      .then((r) => {
        setItems(r.items);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <Seo
        title="AI Pulse 周报归档 — 历史 AI 趋势与事件复盘"
        description="浏览 AI Pulse 已发布的中文 AI 周报归档，复盘每周模型、工具、开源和行业动态。"
        path="/archive"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'AI Pulse 周报归档',
          url: absoluteUrl('/archive'),
          description: '按日期浏览 AI Pulse 已发布的中文 AI 周报。',
        }}
      />
      <header className="section-y">
        <h1 className="heading-page">历史归档</h1>
        <p className="mt-2 max-w-2xl text-body">
          按日期浏览已发布周报，用于复盘与检索。每期对应站内报告页，保留当时的信息整理与来源线索。
        </p>
      </header>

      {err ? (
        <div className="card-surface-muted px-5 py-6 text-sm text-red-700">加载失败：{err}</div>
      ) : null}

      {loading ? (
        <div className="card-surface divide-y divide-[color:var(--border-default)] overflow-hidden p-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse bg-slate-50/80 px-4" aria-hidden />
          ))}
        </div>
      ) : null}

      {!loading && !err ? (
        <>
          {items.length === 0 ? (
            <EmptyState
              title="暂无归档内容"
              description="当前没有可展示的历史周报。数据就绪后，将按报告日期自动出现在此列表；也可稍后在首页查看新的 AI 信号。"
              actionLabel="返回首页"
              actionTo="/"
            />
          ) : (
            <div className="card-surface overflow-hidden p-0">
              <div className="border-b border-[color:var(--border-default)] px-4 py-3 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 md:px-5">
                共 {items.length} 期 · 可检索
              </div>
              <ul className="divide-y divide-[color:var(--border-default)]">
                {items.map((it) => (
                  <li key={it.report_date} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5 md:py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">{it.report_date}</p>
                      <Link
                        to={`/weekly/${it.report_date}`}
                        className="mt-1 block line-clamp-3 font-headline text-base font-semibold leading-snug text-slate-900 no-underline hover:text-primary [overflow-wrap:anywhere]"
                      >
                        {it.title || '（无标题）'}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">站内报告 · 含主线整理与来源</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                      <Link
                        to={`/weekly/${it.report_date}`}
                        className="btn-secondary px-4 py-2 text-xs font-semibold no-underline"
                      >
                        打开报告
                      </Link>
                      {it.weekly_url ? (
                        <a
                          href={it.weekly_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary px-4 py-2 text-xs font-semibold no-underline"
                        >
                          HTML 副本
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
