import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, Eye, MousePointerClick, Users } from 'lucide-react';

import type { AdminAnalyticsSummary, AdminPageviewRow, AdminRankingInterest } from '../api/client';
import { adminAnalyticsPageviews, adminAnalyticsRankingInterest, adminAnalyticsSummary } from '../api/client';
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

function formatShortDay(raw: string): string {
  const parts = raw.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return raw.slice(5) || raw;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AdminAnalyticsSummary | null>(null);
  const [interest, setInterest] = useState<AdminRankingInterest | null>(null);
  const [rows, setRows] = useState<AdminPageviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const [s, ri, pv] = await Promise.all([
          adminAnalyticsSummary(),
          adminAnalyticsRankingInterest({ days: 7, limit: 20 }),
          adminAnalyticsPageviews(150),
        ]);
        setSummary(s);
        setInterest(ri);
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

  const dailyTraffic = useMemo(() => summary?.daily_traffic ?? [], [summary?.daily_traffic]);
  const maxPv = useMemo(() => Math.max(1, ...(summary?.top_pages.map((p) => p.pv) ?? [1])), [summary?.top_pages]);
  const maxDau = useMemo(() => Math.max(1, ...dailyTraffic.map((d) => d.dau)), [dailyTraffic]);
  const avg7Dau = useMemo(() => average(dailyTraffic.slice(-7).map((d) => d.dau)), [dailyTraffic]);
  const avg30Dau = useMemo(() => average(dailyTraffic.map((d) => d.dau)), [dailyTraffic]);
  const todayDau = summary?.today.dau ?? summary?.today.uv ?? 0;
  const topEventClicks = interest?.top_events[0]?.clicks ?? 0;

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AdminStatCard label="今日 DAU" value={todayDau} hint="今日独立访客" icon={<Users className="h-4 w-4" />} tone="emerald" />
            <AdminStatCard label="7 日平均 DAU" value={avg7Dau} hint={`7 日独立 UV ${summary.last_7_days.uv}`} icon={<Activity className="h-4 w-4" />} tone="violet" />
            <AdminStatCard label="30 日平均 DAU" value={avg30Dau} hint={`30 日独立 UV ${summary.last_30_days.uv}`} icon={<CalendarDays className="h-4 w-4" />} tone="blue" />
            <AdminStatCard label="今日 PV / UV" value={`${summary.today.pv} / ${summary.today.uv}`} icon={<Eye className="h-4 w-4" />} tone="slate" />
            <AdminStatCard label="榜单最高点击" value={topEventClicks} hint="近 7 天单事件点击" icon={<MousePointerClick className="h-4 w-4" />} tone="amber" />
          </div>

          <AdminPanel
            title="DAU 趋势（近 30 天）"
            description="DAU 按北京时间自然日去重 visitor_id；同一访客跨天访问会分别计入对应日期。"
          >
            {dailyTraffic.length > 0 ? (
              <div className="overflow-x-auto px-4 py-5">
                <div className="flex min-w-[760px] items-end gap-2">
                  {dailyTraffic.map((d) => {
                    const height = d.dau > 0 ? Math.max(8, Math.round((d.dau / maxDau) * 128)) : 2;
                    return (
                      <div key={d.date} className="flex w-9 shrink-0 flex-col items-center gap-2" title={`${d.date} · DAU ${d.dau} · PV ${d.pv}`}>
                        <div className="flex h-32 w-full items-end justify-center rounded-md bg-slate-50 px-1">
                          <div
                            className="w-full rounded-t-md bg-emerald-500 shadow-sm"
                            style={{ height }}
                            aria-label={`${d.date} DAU ${d.dau}`}
                          />
                        </div>
                        <div className="h-4 text-[11px] font-bold tabular-nums text-slate-900">{d.dau}</div>
                        <div className="text-[10px] font-medium tabular-nums text-slate-400">{formatShortDay(d.date)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <AdminEmpty>暂无 DAU 数据。</AdminEmpty>
            )}
          </AdminPanel>

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

          <AdminPanel title="榜单事件兴趣（近 7 天）" description="按榜单曝光与点击聚合，CTR = 点击 / 曝光；标题和来源为点击当时快照。">
            {interest && interest.top_events.length > 0 ? (
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-[1080px] w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">事件</th>
                      <th className="px-4 py-3">来源</th>
                      <th className="px-4 py-3 text-right">点击</th>
                      <th className="px-4 py-3 text-right">曝光</th>
                      <th className="px-4 py-3 text-right">CTR</th>
                      <th className="px-4 py-3 text-right">点击 UV</th>
                      <th className="px-4 py-3 text-right">最好名次</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interest.top_events.map((r) => (
                      <tr key={`${r.event_id ?? r.title}-${r.source_label ?? ''}`} className="align-top hover:bg-slate-50">
                        <td className="max-w-[420px] px-4 py-3">
                          <div className="line-clamp-2 font-medium text-slate-900">{r.title || '—'}</div>
                          <div className="mt-1 font-mono text-[11px] text-slate-400">{r.event_id ? `#${r.event_id}` : 'no event id'} · {r.category || '—'}</div>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-slate-600" title={r.source_label || ''}>{r.source_label || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">{r.clicks}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.impressions}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-blue-600">{r.ctr}%</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.click_uv}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.best_rank ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmpty>暂无榜单兴趣数据。</AdminEmpty>
            )}
          </AdminPanel>

          <AdminPanel title="来源兴趣（近 7 天）" description="按来源名称聚合，可用于判断哪些媒体 / 官方源带来更多点击。">
            {interest && interest.top_sources.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {interest.top_sources.map((s) => (
                  <div key={`${s.source_label}-${s.source_type ?? ''}`} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_100px_100px_100px_100px] md:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{s.source_label}</div>
                      <div className="mt-1 text-xs text-slate-400">{s.source_type || '—'} · {s.event_count} 个事件</div>
                    </div>
                    <div className="text-sm text-slate-600 md:text-right"><span className="font-semibold tabular-nums text-slate-950">{s.clicks}</span> 点击</div>
                    <div className="text-sm text-slate-600 md:text-right"><span className="font-semibold tabular-nums text-slate-950">{s.impressions}</span> 曝光</div>
                    <div className="text-sm text-blue-600 md:text-right"><span className="font-semibold tabular-nums">{s.ctr}%</span> CTR</div>
                    <div className="text-sm text-slate-600 md:text-right"><span className="font-semibold tabular-nums text-slate-950">{s.click_uv}</span> UV</div>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmpty>暂无来源兴趣数据。</AdminEmpty>
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
