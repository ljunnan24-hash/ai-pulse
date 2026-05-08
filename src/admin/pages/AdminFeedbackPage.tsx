import { useEffect, useState } from 'react';

import type { AdminFeedbackRow } from '../api/client';
import { adminFeedbackList, adminFeedbackPatch } from '../api/client';

const STATUSES = ['new', 'reviewed', 'archived'] as const;

export function AdminFeedbackPage() {
  const [items, setItems] = useState<AdminFeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { status: string; note: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => {
    setError(null);
    try {
      const r = await adminFeedbackList({ limit: 200 });
      setItems(r.items);
      const d: Record<number, { status: string; note: string }> = {};
      for (const x of r.items) {
        d[x.id] = { status: x.status, note: x.admin_note || '' };
      }
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
  }, []);

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
    <div className="space-y-8">
      <div>
        <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">站点运营</div>
        <h1 className="text-3xl md:text-4xl font-extrabold font-headline tracking-tight mt-2">用户反馈</h1>
        <p className="text-on-surface-variant mt-2 max-w-3xl text-sm">
          来自关于页等入口的建议；IP 仅存哈希。
        </p>
      </div>

      {error ? (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container font-semibold">{error}</div>
      ) : null}

      <div className="space-y-6">
        {items.map((row) => (
          <div
            key={row.id}
            className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/10 space-y-3"
          >
            <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
              <span>#{row.id}</span>
              <span>{row.created_at}</span>
              <span>{row.source_page || '—'}</span>
            </div>
            <p className="text-on-surface whitespace-pre-wrap text-sm leading-relaxed">{row.content}</p>
            {row.contact ? (
              <p className="text-sm">
                <span className="text-on-surface-variant">联系方式：</span>
                {row.contact}
              </p>
            ) : null}
            <div className="flex flex-wrap items-end gap-3 pt-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
                状态
                <select
                  className="rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface"
                  value={drafts[row.id]?.status ?? row.status}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [row.id]: { ...prev[row.id], status: e.target.value, note: prev[row.id]?.note ?? '' },
                    }))
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 flex-1 min-w-[200px] text-xs font-medium text-on-surface-variant">
                管理员备注
                <input
                  type="text"
                  className="rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface w-full"
                  value={drafts[row.id]?.note ?? ''}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [row.id]: {
                        status: prev[row.id]?.status ?? row.status,
                        note: e.target.value,
                      },
                    }))
                  }
                  placeholder="内部备注"
                />
              </label>
              <button
                type="button"
                disabled={saving === row.id}
                onClick={() => void saveRow(row.id)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
              >
                {saving === row.id ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-on-surface-variant text-sm">暂无反馈。</p>
        ) : null}
      </div>
    </div>
  );
}
