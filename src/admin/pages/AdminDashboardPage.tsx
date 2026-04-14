import { useEffect, useMemo, useState } from 'react';
import type { AdminMetrics } from '../api/client';
import { adminMetrics } from '../api/client';
import { useNavigate } from 'react-router-dom';

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0px_12px_40px_rgba(25,28,30,0.04)] border border-outline-variant/10">
      <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <h3 className="text-3xl font-extrabold text-on-surface font-headline tracking-tight">{value}</h3>
    </div>
  );
}

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

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Administrative Control</div>
        <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight mt-2">Dashboard</h1>
        <p className="text-on-surface-variant mt-2 max-w-2xl">
          首次进入加载一次数据；点击右上角刷新按钮才会更新。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard label="Total" value={metrics.total} />
        <MetricCard label="Active Confirmed" value={metrics.active_confirmed} />
        <MetricCard label="Pending" value={metrics.pending} />
        <MetricCard label="Unsubscribed" value={metrics.unsubscribed} />
      </div>

      {error ? (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container font-semibold">
          Dashboard 加载失败：{error}
        </div>
      ) : null}

      <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold font-headline tracking-tight">Top 20 Keywords</h2>
            <p className="text-on-surface-variant text-sm mt-1">点击关键词可跳转到订阅者列表并自动筛选。</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {top.map((k, idx) => (
            <button
              key={k.keyword}
              onClick={() => nav(`/admin/subscribers?keyword=${encodeURIComponent(k.keyword)}`)}
              className="text-left bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 hover:bg-surface-container-low transition"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 text-outline font-bold tabular-nums">{String(idx + 1).padStart(2, '0')}</div>
                  <div className="font-semibold text-on-surface truncate">{k.keyword}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-on-surface tabular-nums">{k.active_confirmed_count}</div>
                  <div className="text-[10px] text-outline uppercase font-medium">Active</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

