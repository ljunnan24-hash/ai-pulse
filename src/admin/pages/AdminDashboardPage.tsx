import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock3, Mail, UserX } from 'lucide-react';

import type { AdminMetrics } from '../api/client';
import { adminMetrics } from '../api/client';
import { AdminEmpty, AdminError, AdminPageHeader, AdminPanel, AdminStatCard } from '../components/AdminUI';

export function AdminDashboardPage() {
  const nav = useNavigate();
  const [metrics, setMetrics] = useState<AdminMetrics>({
    total: 0,
    active_confirmed: 0,
    pending: 0,
    unsubscribed: 0,
    top_keywords: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        setMetrics(await adminMetrics());
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    };
    const handler = () => void load();
    void load();
    window.addEventListener('aipulse-admin-refresh', handler);
    return () => window.removeEventListener('aipulse-admin-refresh', handler);
  }, []);

  const top = useMemo(() => metrics.top_keywords.slice(0, 20), [metrics.top_keywords]);
  const activeRate = metrics.total > 0 ? `${Math.round((metrics.active_confirmed / metrics.total) * 100)}%` : '0%';

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Administrative Control"
        title="后台概览"
        description="查看订阅规模、确认状态和高频关键词。右上角刷新只更新后台数据，不影响公开站点。"
      />

      {error ? <AdminError>Dashboard 加载失败：{error}</AdminError> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard label="订阅总数" value={metrics.total} hint="全部状态合计" icon={<Mail className="h-4 w-4" />} />
        <AdminStatCard label="已确认" value={metrics.active_confirmed} hint={`确认率 ${activeRate}`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <AdminStatCard label="待确认" value={metrics.pending} hint="需要邮件确认" icon={<Clock3 className="h-4 w-4" />} />
        <AdminStatCard label="已退订" value={metrics.unsubscribed} hint="不再发送周报" icon={<UserX className="h-4 w-4" />} />
        <AdminStatCard label="关键词数" value={metrics.top_keywords.length} hint="Top keywords 样本" />
      </div>

      <AdminPanel
        title="Top Keywords"
        description="点击关键词进入订阅者列表并自动筛选。"
      >
        {top.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-16 px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Keyword</th>
                  <th className="w-32 px-4 py-3 text-right">Active</th>
                  <th className="w-28 px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top.map((k, idx) => (
                  <tr key={k.keyword} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => nav(`/admin/subscribers?keyword=${encodeURIComponent(k.keyword)}`)}
                        className="font-semibold text-slate-950 hover:text-blue-700 hover:underline"
                      >
                        {k.keyword}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{k.active_confirmed_count}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => nav(`/admin/subscribers?keyword=${encodeURIComponent(k.keyword)}`)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        查看订阅者
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmpty>暂无关键词数据。</AdminEmpty>
        )}
      </AdminPanel>
    </div>
  );
}
