import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';

import type { AdminFeedbackRow } from '../api/client';
import { adminFeedbackList, adminFeedbackPatch } from '../api/client';
import { AdminButton, AdminEmpty, AdminError, AdminPageHeader, AdminPanel, AdminStatCard, AdminStatusBadge } from '../components/AdminUI';

const STATUSES = ['new', 'reviewed', 'archived'] as const;

function formatDate(raw: string | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminFeedbackRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { status: string; note: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => {
    setError(null);
    try {
      const r = await adminFeedbackList({ status: statusFilter || undefined, limit: 200 });
      setItems(r.items);
      const d: Record<number, { status: string; note: string }> = {};
      for (const x of r.items) d[x.id] = { status: x.status, note: x.admin_note || '' };
      setDrafts(d);
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
  }, [statusFilter]);

  const counts = useMemo(
    () => ({
      total: items.length,
      new: items.filter((x) => x.status === 'new').length,
      reviewed: items.filter((x) => x.status === 'reviewed').length,
      archived: items.filter((x) => x.status === 'archived').length,
    }),
    [items],
  );

  async function saveRow(id: number) {
    const d = drafts[id];
    if (!d) return;
    setSaving(id);
    setError(null);
    try {
      await adminFeedbackPatch(id, { status: d.status, admin_note: d.note || null });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="User Voice"
        title="用户反馈"
        description="处理来自关于页等入口的建议。IP 仅存哈希，管理员备注仅用于内部跟进。"
      />

      {error ? <AdminError>{error}</AdminError> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard label="当前结果" value={counts.total} />
        <AdminStatCard label="New" value={counts.new} />
        <AdminStatCard label="Reviewed" value={counts.reviewed} />
        <AdminStatCard label="Archived" value={counts.archived} />
      </div>

      <AdminPanel title="处理队列" actions={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">全部状态</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      }>
        {items.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {items.map((row) => {
              const draft = drafts[row.id] ?? { status: row.status, note: row.admin_note || '' };
              return (
                <article key={row.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono">#{row.id}</span>
                      <span>{formatDate(row.created_at)}</span>
                      <span>{row.source_page || '未知来源'}</span>
                      <AdminStatusBadge status={row.status} />
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{row.content}</p>
                    {row.contact ? (
                      <p className="mt-3 text-sm text-slate-600">
                        <span className="font-semibold text-slate-700">联系方式：</span>{row.contact}
                      </p>
                    ) : null}
                    {row.user_agent ? <p className="mt-2 truncate text-xs text-slate-400" title={row.user_agent}>UA: {row.user_agent}</p> : null}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-xs font-semibold text-slate-500">
                        状态
                        <select
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          value={draft.status}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.id]: { status: e.target.value, note: prev[row.id]?.note ?? '' },
                            }))
                          }
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-slate-500">
                        管理员备注
                        <input
                          type="text"
                          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          value={draft.note}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [row.id]: { status: prev[row.id]?.status ?? row.status, note: e.target.value },
                            }))
                          }
                          placeholder="内部备注"
                        />
                      </label>
                      <AdminButton variant="primary" disabled={saving === row.id} onClick={() => void saveRow(row.id)}>
                        <Save className="h-4 w-4" aria-hidden />
                        {saving === row.id ? '保存中…' : '保存'}
                      </AdminButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <AdminEmpty>暂无反馈。</AdminEmpty>
        )}
      </AdminPanel>
    </div>
  );
}
