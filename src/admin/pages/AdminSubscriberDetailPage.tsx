import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MailCheck, Send, UserX } from 'lucide-react';

import type { AdminSubscriberRow } from '../api/client';
import { adminResendConfirmation, adminResendLatestWeekly, adminSubscriber, adminUnsubscribe } from '../api/client';
import { AdminButton, AdminError, AdminLoadingLabel, AdminPageHeader, AdminPanel, AdminStatCard, AdminStatusBadge } from '../components/AdminUI';

function formatDate(raw: string | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('zh-CN');
}

export function AdminSubscriberDetailPage() {
  const { id } = useParams();
  const [sub, setSub] = useState<AdminSubscriberRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const parsedId = useMemo(() => {
    if (!id) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const load = async () => {
    setError(null);
    if (!parsedId) {
      setLoading(false);
      return;
    }
    try {
      setSub(await adminSubscriber(parsedId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedId]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('aipulse-admin-refresh', handler);
    return () => window.removeEventListener('aipulse-admin-refresh', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedId]);

  const runAction = async (kind: 'confirm' | 'weekly' | 'unsub') => {
    if (!parsedId) return;
    const messages = {
      confirm: '确认重发确认邮件？',
      weekly: '确认重发最新一期周报？',
      unsub: '确认要将该订阅者退订？',
    };
    if (!confirm(messages[kind])) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'confirm') await adminResendConfirmation(parsedId);
      if (kind === 'weekly') await adminResendLatestWeekly(parsedId);
      if (kind === 'unsub') await adminUnsubscribe(parsedId);
      setSub(await adminSubscriber(parsedId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Link className="text-sm font-semibold text-blue-600 hover:underline" to="/admin/subscribers">← 返回订阅者</Link>
        <AdminPanel>
          <div className="p-6"><AdminLoadingLabel /></div>
        </AdminPanel>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="space-y-5">
        <Link className="text-sm font-semibold text-blue-600 hover:underline" to="/admin/subscribers">← 返回订阅者</Link>
        {error ? <AdminError>加载失败：{error}</AdminError> : null}
        <AdminPanel><div className="p-6 text-sm text-slate-500">未找到订阅者（id={id}）。</div></AdminPanel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Subscriber Detail"
        title={sub.email}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>id #{sub.id}</span>
            <AdminStatusBadge status={sub.status} />
            <span>mode {sub.mode}</span>
          </span>
        }
        actions={
          <>
            <AdminButton disabled={busy !== null} onClick={() => void runAction('confirm')}>
              <MailCheck className="h-4 w-4" aria-hidden />
              {busy === 'confirm' ? '发送中…' : '重发确认'}
            </AdminButton>
            <AdminButton disabled={busy !== null} onClick={() => void runAction('weekly')}>
              <Send className="h-4 w-4" aria-hidden />
              {busy === 'weekly' ? '发送中…' : '重发周报'}
            </AdminButton>
            <AdminButton variant="danger" disabled={busy !== null} onClick={() => void runAction('unsub')}>
              <UserX className="h-4 w-4" aria-hidden />
              {busy === 'unsub' ? '处理中…' : '退订'}
            </AdminButton>
          </>
        }
      />

      <Link className="text-sm font-semibold text-blue-600 hover:underline" to="/admin/subscribers">← 返回订阅者列表</Link>
      {error ? <AdminError>操作/加载失败：{error}</AdminError> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <AdminStatCard label="Created" value={formatDate(sub.created_at)} />
        <AdminStatCard label="Confirmed" value={formatDate(sub.confirmed_at)} />
        <AdminStatCard label="Last sent" value={formatDate(sub.last_sent_at)} />
        <AdminStatCard label="Send count" value={sub.send_count} />
      </div>

      <AdminPanel title="关键词">
        <div className="flex flex-wrap gap-2 p-4">
          {sub.keywords.length > 0 ? sub.keywords.map((k) => (
            <span key={k} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
              {k}
            </span>
          )) : <span className="text-sm text-slate-500">暂无关键词。</span>}
        </div>
      </AdminPanel>

      <AdminPanel title="Raw keywords JSON" description="调试订阅偏好时使用。">
        <pre className="overflow-x-auto bg-slate-950 p-4 text-sm leading-6 text-slate-100">
{JSON.stringify(sub.keywords, null, 2)}
        </pre>
      </AdminPanel>
    </div>
  );
}
