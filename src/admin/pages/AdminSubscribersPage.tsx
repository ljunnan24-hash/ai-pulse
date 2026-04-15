import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AdminSubscriberRow } from '../api/client';
import { adminExportCsvUrl, adminSubscribers } from '../api/client';
import { getAdminToken } from '../auth/adminToken';

function StatusBadge({ status }: { status: AdminSubscriberRow['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-container/30 text-primary text-[10px] font-bold uppercase rounded-full tracking-wider border border-primary/10">
        <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
        Active
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-low text-on-surface-variant text-[10px] font-bold uppercase rounded-full tracking-wider border border-outline-variant/20">
        <span className="w-1.5 h-1.5 rounded-full bg-outline" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-error-container text-on-error-container text-[10px] font-bold uppercase rounded-full tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-error" />
      Unsubscribed
    </span>
  );
}

function KeywordTags({ keywords }: { keywords: string[] }) {
  const max = 6;
  const head = keywords.slice(0, max);
  const rest = keywords.length - head.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {head.map((k) => (
        <span
          key={k}
          className="px-2 py-0.5 bg-secondary-container/20 text-on-secondary-container text-[10px] font-bold rounded uppercase"
        >
          {k}
        </span>
      ))}
      {rest > 0 ? (
        <span className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant text-[10px] font-bold rounded uppercase">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

export function AdminSubscribersPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword')?.trim() || '';

  const [rows, setRows] = useState<AdminSubscriberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const data = await adminSubscribers({ keyword: keyword || undefined, limit: 200, offset: 0 });
        setRows(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    };
    const handler = () => void load();
    void load();
    window.addEventListener('aipulse-admin-refresh', handler);
    return () => window.removeEventListener('aipulse-admin-refresh', handler);
  }, [keyword]);

  const filtered = useMemo(() => {
    if (!keyword) return rows;
    const kw = keyword.toLowerCase();
    return rows.filter((r) => r.keywords.some((k) => k.toLowerCase() === kw));
  }, [keyword, rows]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Administrative Control</div>
        <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight mt-2">Subscribers</h1>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          支持按关键词 Tag 筛选。当前为 UI mock 数据，后续接入 `/admin/subscribers` 接口即可。
        </p>
      </div>

      <section className="bg-surface-container-low p-4 md:p-6 rounded-3xl border border-outline-variant/10 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-outline">Keyword</span>
          <input
            value={keyword}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                params.delete('keyword');
                setParams(params, { replace: true });
              } else {
                params.set('keyword', v);
                setParams(params, { replace: true });
              }
            }}
            placeholder="ai"
            className="bg-surface-container-lowest rounded-2xl px-4 py-2 text-sm border border-outline-variant/20 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {keyword ? (
          <button
            className="text-xs font-bold uppercase tracking-widest text-primary hover:underline"
            onClick={() => {
              params.delete('keyword');
              setParams(params, { replace: true });
            }}
          >
            清除
          </button>
        ) : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        {error ? (
          <div className="p-3 rounded-2xl bg-error-container text-on-error-container font-semibold">
            Subscribers 加载失败：{error}
          </div>
        ) : (
          <div className="text-sm text-on-surface-variant">共 {filtered.length} 条</div>
        )}
        <button
          type="button"
          className="px-4 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/20 font-semibold text-sm hover:bg-surface-container-high transition disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={exporting}
          onClick={async () => {
            const token = getAdminToken();
            if (!token) {
              setError('未登录或登录已过期，请重新登录后再导出。');
              return;
            }
            setExporting(true);
            setError(null);
            try {
              const url = adminExportCsvUrl({ keyword: keyword || undefined });
              const res = await fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(txt || `导出失败（${res.status}）`);
              }
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              const safeKw = keyword ? keyword.replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 32) : '';
              const ts = new Date();
              const pad = (n: number) => String(n).padStart(2, '0');
              const filename = `subscribers${safeKw ? `_${safeKw}` : ''}_${ts.getFullYear()}${pad(
                ts.getMonth() + 1
              )}${pad(ts.getDate())}.csv`;
              a.href = blobUrl;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(blobUrl);
            } catch (e) {
              setError(e instanceof Error ? e.message : '导出失败');
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? '导出中…' : '导出 CSV'}
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0px_12px_40px_rgba(25,28,30,0.04)] border border-outline-variant/10">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest">ID</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest">Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest">Mode</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest">Keywords</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest">Created</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest text-right">Sends</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant tracking-widest text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-6 py-5 font-mono text-xs text-outline">#{r.id}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-on-surface font-semibold text-sm">{r.email}</span>
                      <span className="text-[10px] text-outline uppercase">confirmed: {r.confirmed_at ? 'yes' : 'no'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">{r.mode}</td>
                  <td className="px-6 py-5">
                    <KeywordTags keywords={r.keywords} />
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant whitespace-nowrap">{r.created_at}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-on-surface tabular-nums">{r.send_count}</span>
                      <span className="text-[10px] text-outline">last: {r.last_sent_at ?? '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      to={`/admin/subscribers/${r.id}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-on-surface-variant" colSpan={8}>
                    无匹配数据。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

