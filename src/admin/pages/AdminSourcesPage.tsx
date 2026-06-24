import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-react';

import type { AdminRssHealthOut, AdminRssSource, AdminRssSourcesOut } from '../api/client';
import {
  adminCreateRssSource,
  adminDeleteRssSource,
  adminImportEnvRssSources,
  adminPatchRssSource,
  adminRssHealth,
  adminRssSources,
} from '../api/client';
import { AdminButton, AdminEmpty, AdminError, AdminPageHeader, AdminPanel, AdminStatCard, AdminStatusBadge } from '../components/AdminUI';

const channelLabels: Record<string, string> = {
  official: '官方',
  meta: 'Meta',
  media: '媒体',
  product: '产品',
  community: '社区',
  x: 'X / Social',
};

function formatDate(raw: string | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function truncateUrl(url: string): string {
  return url.length > 86 ? `${url.slice(0, 84)}…` : url;
}

export function AdminSourcesPage() {
  const [sources, setSources] = useState<AdminRssSourcesOut | null>(null);
  const [health, setHealth] = useState<AdminRssHealthOut | null>(null);
  const [onlyUnhealthy, setOnlyUnhealthy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', channel: 'official', is_enabled: true });

  const load = async () => {
    setError(null);
    try {
      const [sourceData, healthData] = await Promise.all([
        adminRssSources(),
        adminRssHealth({ days: 14, only_unhealthy: onlyUnhealthy }),
      ]);
      setSources(sourceData);
      setHealth(healthData);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  };

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener('aipulse-admin-refresh', handler);
    return () => window.removeEventListener('aipulse-admin-refresh', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyUnhealthy]);

  const visibleSources = useMemo(() => {
    if (!sources) return [];
    return sources.using_database ? sources.items : sources.env_items;
  }, [sources]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.url.trim()) {
      setError('请输入 RSS URL。');
      return;
    }
    setBusy('create');
    setError(null);
    try {
      await adminCreateRssSource({
        name: form.name.trim() || undefined,
        url: form.url.trim(),
        channel: form.channel,
        is_enabled: form.is_enabled,
      });
      setForm({ name: '', url: '', channel: form.channel, is_enabled: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失败');
    } finally {
      setBusy(null);
    }
  };

  const importEnv = async () => {
    setBusy('import');
    setError(null);
    try {
      await adminImportEnvRssSources();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(null);
    }
  };

  const toggleSource = async (source: AdminRssSource) => {
    if (source.id == null) return;
    setBusy(`toggle-${source.id}`);
    setError(null);
    try {
      await adminPatchRssSource(source.id, { is_enabled: !source.is_enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setBusy(null);
    }
  };

  const deleteSource = async (source: AdminRssSource) => {
    if (source.id == null) return;
    if (!confirm(`删除 RSS 源？\n${source.url}`)) return;
    setBusy(`delete-${source.id}`);
    setError(null);
    try {
      await adminDeleteRssSource(source.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Source Operations"
        title="信源管理"
        description="管理每日排行榜抓取使用的 RSS 源，并观察每个源最近一次抓取状态。"
        actions={
          <AdminButton onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            刷新
          </AdminButton>
        }
      />

      {error ? <AdminError>{error}</AdminError> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <AdminStatCard label="有效源" value={sources?.effective_count ?? 0} tone="emerald" />
        <AdminStatCard label="总配置" value={visibleSources.length} tone="blue" />
        <AdminStatCard label="失败" value={health?.summary.failing ?? 0} tone="rose" />
        <AdminStatCard label="警告" value={health?.summary.warning ?? 0} tone="amber" />
        <AdminStatCard label="无数据" value={health?.summary.no_data ?? 0} tone="slate" />
      </div>

      {sources && !sources.using_database && sources.env_items.length > 0 ? (
        <AdminPanel
          title="导入当前 .env RSS 源"
          description="导入后，后台表会成为 RSS 源的管理入口；现有 .env 源会原样写入数据库。"
          actions={
            <AdminButton variant="primary" disabled={busy === 'import'} onClick={() => void importEnv()}>
              <UploadCloud className="h-4 w-4" aria-hidden />
              {busy === 'import' ? '导入中…' : '导入'}
            </AdminButton>
          }
        >
          <div className="px-4 py-3 text-sm text-slate-600">当前仍在使用 .env RSS 配置，共 {sources.env_items.length} 个源。</div>
        </AdminPanel>
      ) : null}

      <AdminPanel title="新增 RSS 源">
        <form className="grid gap-3 p-4 lg:grid-cols-[180px_minmax(260px,1fr)_160px_120px] lg:items-center" onSubmit={submit}>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="名称"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <input
            value={form.url}
            onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://example.com/feed.xml"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={form.channel}
            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {(sources?.channels ?? Object.entries(channelLabels).map(([value]) => ({ value, tier: 0 }))).map((ch) => (
              <option key={ch.value} value={ch.value}>
                {channelLabels[ch.value] ?? ch.value} · P{ch.tier}
              </option>
            ))}
          </select>
          <AdminButton type="submit" variant="primary" disabled={busy === 'create'}>
            <Plus className="h-4 w-4" aria-hidden />
            {busy === 'create' ? '添加中…' : '添加'}
          </AdminButton>
        </form>
      </AdminPanel>

      <AdminPanel title="RSS 源列表" description={sources?.using_database ? '后台数据库配置正在生效。' : '当前展示 .env 源；导入后可启停或删除。'}>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">频道</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSources.map((source) => (
                <tr key={source.url_hash} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950">{source.name}</div>
                    <div className="mt-1 font-mono text-xs text-slate-400">P{source.tier}</div>
                  </td>
                  <td className="max-w-[460px] break-all px-4 py-3 font-mono text-xs text-slate-700" title={source.url}>{truncateUrl(source.url)}</td>
                  <td className="px-4 py-3 text-slate-600">{channelLabels[source.channel] ?? source.channel}</td>
                  <td className="px-4 py-3"><AdminStatusBadge status={source.is_enabled ? 'active' : 'archived'} /></td>
                  <td className="px-4 py-3 text-right">
                    {source.id == null ? (
                      <span className="text-xs text-slate-400">只读</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <AdminButton variant="secondary" disabled={busy === `toggle-${source.id}`} onClick={() => void toggleSource(source)}>
                          {source.is_enabled ? '停用' : '启用'}
                        </AdminButton>
                        <AdminButton variant="danger" disabled={busy === `delete-${source.id}`} onClick={() => void deleteSource(source)} title="删除">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </AdminButton>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleSources.length === 0 ? <AdminEmpty>暂无 RSS 源。</AdminEmpty> : null}
      </AdminPanel>

      <AdminPanel
        title="抓取健康"
        description="最近 14 天的抓取结果；失败、警告、无数据优先展示。"
        actions={
          <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={onlyUnhealthy}
              onChange={(e) => setOnlyUnhealthy(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            仅看异常
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">源</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">HTTP</th>
                <th className="px-4 py-3 text-right">条目</th>
                <th className="px-4 py-3 text-right">失败</th>
                <th className="px-4 py-3">最近抓取</th>
                <th className="px-4 py-3">错误</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(health?.items ?? []).map((item) => (
                <tr key={item.feed_url} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950">{item.source_name}</div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-500">{truncateUrl(item.feed_url)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={item.latest?.health_status || item.severity} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.latest?.http_status ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{item.latest?.emitted_item_count ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-semibold tabular-nums text-slate-950">{item.failure_count}</div>
                    <div className="text-xs text-slate-500">连续 {item.consecutive_failures}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.latest?.run_at ?? null)}</td>
                  <td className="max-w-[320px] px-4 py-3 text-xs text-slate-500">
                    <div className="truncate" title={item.latest?.error_message || ''}>{item.latest?.error_class || item.latest?.error_message || '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(health?.items.length ?? 0) === 0 ? <AdminEmpty>暂无抓取健康数据。</AdminEmpty> : null}
      </AdminPanel>
    </div>
  );
}
