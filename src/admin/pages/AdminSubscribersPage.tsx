import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Search, X } from 'lucide-react';

import type { AdminSubscriberRow } from '../api/client';
import { adminExportCsvUrl, adminSubscribers } from '../api/client';
import { getAdminToken } from '../auth/adminToken';
import { AdminButton, AdminEmpty, AdminError, AdminPageHeader, AdminPanel, AdminStatCard, AdminStatusBadge } from '../components/AdminUI';

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
] as const;

function KeywordTags({ keywords }: { keywords: string[] }) {
  const head = keywords.slice(0, 4);
  const rest = keywords.length - head.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {head.map((k) => (
        <span key={k} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {k}
        </span>
      ))}
      {rest > 0 ? <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">+{rest}</span> : null}
    </div>
  );
}

function formatDate(raw: string | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('zh-CN');
}

export function AdminSubscribersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() || '';
  const keyword = params.get('keyword')?.trim() || '';
  const status = params.get('status')?.trim() || '';

  const [rows, setRows] = useState<AdminSubscriberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value.trim()) next.set(key, value.trim());
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const clearFilters = () => {
    setParams(new URLSearchParams(), { replace: true });
  };

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const data = await adminSubscribers({
          q: q || undefined,
          status: status || undefined,
          keyword: keyword || undefined,
          limit: 200,
          offset: 0,
        });
        setRows(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    };
    const handler = () => void load();
    void load();
    window.addEventListener('aipulse-admin-refresh', handler);
    return () => window.removeEventListener('aipulse-admin-refresh', handler);
  }, [q, status, keyword]);

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase();
    const kwLower = keyword.toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (keyword && !r.keywords.some((k) => k.toLowerCase() === kwLower)) return false;
      if (qLower && !r.email.toLowerCase().includes(qLower)) return false;
      return true;
    });
  }, [keyword, q, rows, status]);

  const counts = useMemo(
    () => ({
      total: filtered.length,
      active: filtered.filter((r) => r.status === 'active').length,
      pending: filtered.filter((r) => r.status === 'pending').length,
      unsubscribed: filtered.filter((r) => r.status === 'unsubscribed').length,
    }),
    [filtered],
  );

  const exportCsv = async () => {
    const token = getAdminToken();
    if (!token) {
      setError('未登录或登录已过期，请重新登录后再导出。');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const url = adminExportCsvUrl({ keyword: keyword || undefined, status: status || undefined });
      const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
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
      a.href = blobUrl;
      a.download = `subscribers${safeKw ? `_${safeKw}` : ''}_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Audience Operations"
        title="订阅者管理"
        description="筛选订阅状态、关键词和邮箱；进入详情页可重发确认、重发周报或执行退订。"
        actions={
          <AdminButton disabled={exporting} onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" aria-hidden />
            {exporting ? '导出中…' : '导出 CSV'}
          </AdminButton>
        }
      />

      {error ? <AdminError>{error}</AdminError> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard label="当前结果" value={counts.total} />
        <AdminStatCard label="Active" value={counts.active} />
        <AdminStatCard label="Pending" value={counts.pending} />
        <AdminStatCard label="Unsubscribed" value={counts.unsubscribed} />
      </div>

      <AdminPanel
        title="筛选"
        actions={
          q || keyword || status ? (
            <AdminButton variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden />
              清空筛选
            </AdminButton>
          ) : null
        }
      >
        <div className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_180px_minmax(180px,260px)] md:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={q}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="搜索邮箱"
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <select
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            value={keyword}
            onChange={(e) => updateParam('keyword', e.target.value)}
            placeholder="关键词，例如 Agent"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </AdminPanel>

      <AdminPanel
        title="订阅者列表"
        description={`显示 ${filtered.length} 条，最多加载 200 条。`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Keywords</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Sends</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">#{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950">{r.email}</div>
                    <div className="mt-0.5 text-xs text-slate-500">confirmed: {r.confirmed_at ? 'yes' : 'no'}</div>
                  </td>
                  <td className="px-4 py-3"><AdminStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{r.mode}</td>
                  <td className="px-4 py-3"><KeywordTags keywords={r.keywords} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold tabular-nums text-slate-950">{r.send_count}</div>
                    <div className="text-xs text-slate-500">{formatDate(r.last_sent_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/subscribers/${r.id}`} className="text-sm font-semibold text-blue-600 hover:underline">
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <AdminEmpty>无匹配订阅者。</AdminEmpty> : null}
      </AdminPanel>
    </div>
  );
}
