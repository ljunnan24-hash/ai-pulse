import { useEffect, useState } from 'react';

import type { AdminAnalyticsSummary, AdminPageviewRow } from '../api/client';
import { adminAnalyticsPageviews, adminAnalyticsSummary } from '../api/client';

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0px_12px_40px_rgba(25,28,30,0.04)] border border-outline-variant/10">
      <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <h3 className="text-3xl font-extrabold text-on-surface font-headline tracking-tight">{value}</h3>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [rows, setRows] = useState<AdminPageviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const [s, pv] = await Promise.all([adminAnalyticsSummary(), adminAnalyticsPageviews(150)]);
        setSummary(s);
        setRows(pv.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    };
    const handler = () => void load();
    void load();
    window.addEventListener('aipulse-admin-refresh', handler);
    return () => window.removeEventListener('aipulse-admin-refresh', handler);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">站点运营</div>
        <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight mt-2">访问统计</h1>
        <p className="text-on-surface-variant mt-2 max-w-3xl text-sm leading-relaxed">
          {summary?.timezone_note ??
            'PV / UV 基于匿名 visitor_id 与页面路径；IP 仅存哈希。'}
        </p>
      </div>

      {error ? (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container font-semibold">{error}</div>
      ) : null}

      {summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard label="今日 PV" value={summary.today.pv} />
            <MetricCard label="今日 UV" value={summary.today.uv} />
            <div />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard label="近 7 天 PV" value={summary.last_7_days.pv} />
            <MetricCard label="近 7 天 UV" value={summary.last_7_days.uv} />
            <div />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard label="近 30 天 PV" value={summary.last_30_days.pv} />
            <MetricCard label="近 30 天 UV" value={summary.last_30_days.uv} />
            <div />
          </div>

          <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10">
            <h2 className="text-xl font-bold font-headline">热门页面（近 7 天）</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant">
                    <th className="py-2 pr-4">路径</th>
                    <th className="py-2 pr-4">PV</th>
                    <th className="py-2">UV</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.top_pages.map((p) => (
                    <tr key={p.path} className="border-b border-outline-variant/10">
                      <td className="py-2 pr-4 font-mono text-xs break-all">{p.path}</td>
                      <td className="py-2 pr-4 tabular-nums">{p.pv}</td>
                      <td className="py-2 tabular-nums">{p.uv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary.top_pages.length === 0 ? (
                <p className="text-on-surface-variant text-sm mt-2">暂无数据。</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10">
        <h2 className="text-xl font-bold font-headline">最近访问记录</h2>
        <div className="mt-4 overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-surface-container-low">
              <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant">
                <th className="py-2 pr-2">时间</th>
                <th className="py-2 pr-2">路径</th>
                <th className="py-2 pr-2">visitor</th>
                <th className="py-2">UA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/10 align-top">
                  <td className="py-2 pr-2 whitespace-nowrap tabular-nums">{r.created_at}</td>
                  <td className="py-2 pr-2 font-mono break-all">{r.path}</td>
                  <td className="py-2 pr-2 font-mono break-all">
                    {r.visitor_id ? `${r.visitor_id.slice(0, 12)}…` : '—'}
                  </td>
                  <td className="py-2 max-w-[200px] truncate" title={r.user_agent || ''}>
                    {r.user_agent || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="text-on-surface-variant text-sm mt-2">暂无埋点记录。</p> : null}
        </div>
      </div>
    </div>
  );
}
