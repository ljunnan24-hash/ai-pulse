import { useEffect, useMemo, useState } from 'react';
import { Activity, Eye, Users } from 'lucide-react';

import type { AdminAnalyticsSummary, AdminPageviewRow } from '../api/client';
import { adminAnalyticsPageviews, adminAnalyticsSummary } from '../api/client';
import { AdminEmpty, AdminError, AdminPageHeader, AdminPanel, AdminStatCard } from '../components/AdminUI';

function shortVisitor(v: string | null): string {
  return v ? `${v.slice(0, 12)}…` : '—';
}

function formatDate(raw: string | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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

  const maxPv = useMemo(() => Math.max(1, ...(summary?.top_pages.map((p) => p.pv) ?? [1])), [summary?.top_pages]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Site Operations"
        title="访问统计"
        description={summary?.timezone_note ?? 'PV / UV 基于匿名 visitor_id 与页面路径；IP 仅存哈希。'}
      />

      {error ? <AdminError>{error}</AdminError> : null}

      {summary ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <AdminStatCard label="今日 PV / UV" value={`${summary.today.pv} / ${summary.today.uv}`} icon={<Eye className="h-4 w-4" />} />
            <AdminStatCard label="近 7 天 PV / UV" value={`${summary.last_7_days.pv} / ${summary.last_7_days.uv}`} icon={<Activity className="h-4 w-4" />} />
            <AdminStatCard label="近 30 天 PV / UV" value={`${summary.last_30_days.pv} / ${summary.last_30_days.uv}`} icon={<Users className="h-4 w-4" />} />
          </div>

          <AdminPanel title="热门页面（近 7 天）" description="按 PV 排序，条形长度用于快速比较访问集中度。">
            {summary.top_pages.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {summary.top_pages.map((p) => (
                  <div key={p.path} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_120px] md:items-center">
                    <div className="min-w-0">
                      <div className="break-all font-mono text-xs text-slate-800">{p.path}</div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.max(6, (p.pv / maxPv) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 md:text-right">
                      <span className="font-semibold tabular-nums text-slate-950">{p.pv}</span> PV
                    </div>
                    <div className="text-sm text-slate-600 md:text-right">
                      <span className="font-semibold tabular-nums text-slate-950">{p.uv}</span> UV
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmpty>暂无热门页面数据。</AdminEmpty>
            )}
          </AdminPanel>
        </>
      ) : null}

      <AdminPanel title="最近访问记录" description="最多显示 150 条，便于排查页面和访问来源。">
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-[960px] w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3">路径</th>
                <th className="px-4 py-3">Visitor</th>
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">UA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatDate(r.created_at)}</td>
                  <td className="max-w-[280px] break-all px-4 py-3 font-mono text-slate-800">{r.path}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{shortVisitor(r.visitor_id)}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-500" title={r.referrer || ''}>{r.referrer || '—'}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-slate-500" title={r.user_agent || ''}>{r.user_agent || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <AdminEmpty>暂无埋点记录。</AdminEmpty> : null}
      </AdminPanel>
    </div>
  );
}
