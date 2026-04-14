import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AdminSubscriberRow } from '../api/client';
import { adminResendConfirmation, adminResendLatestWeekly, adminSubscriber, adminUnsubscribe } from '../api/client';

export function AdminSubscriberDetailPage() {
  const { id } = useParams();
  const [sub, setSub] = useState<AdminSubscriberRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const parsedId = useMemo(() => {
    if (!id) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  useEffect(() => {
    const load = async () => {
      setError(null);
      if (!parsedId) return;
      try {
        setSub(await adminSubscriber(parsedId));
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    };
    void load();
  }, [parsedId]);

  useEffect(() => {
    const handler = async () => {
      if (!parsedId) return;
      try {
        setSub(await adminSubscriber(parsedId));
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      }
    };
    window.addEventListener('aipulse-admin-refresh', handler);
    return () => window.removeEventListener('aipulse-admin-refresh', handler);
  }, [parsedId]);

  if (!sub) {
    return (
      <div className="space-y-4">
        <Link className="text-primary font-semibold hover:underline" to="/admin/subscribers">
          ← Back
        </Link>
        <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10">
          {error ? `加载失败：${error}` : `未找到订阅者（id=${id}）。`}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-on-surface-variant">
        <Link className="text-primary font-semibold hover:underline" to="/admin/subscribers">
          Subscribers
        </Link>{' '}
        / <span className="text-on-surface">{sub.email}</span>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold font-headline tracking-tight">{sub.email}</h1>
          <p className="text-on-surface-variant mt-1">
            id #{sub.id} · status {sub.status} · mode {sub.mode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy !== null}
            className="px-4 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/20 font-semibold text-sm hover:bg-surface-container-high transition disabled:opacity-60"
            onClick={async () => {
              if (!parsedId) return;
              if (!confirm('确认重发确认邮件？')) return;
              setBusy('confirm');
              setError(null);
              try {
                await adminResendConfirmation(parsedId);
                alert('已触发重发确认邮件。');
              } catch (e) {
                setError(e instanceof Error ? e.message : '操作失败');
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'confirm' ? '发送中…' : '重发确认'}
          </button>
          <button
            disabled={busy !== null}
            className="px-4 py-2 rounded-2xl bg-surface-container-low border border-outline-variant/20 font-semibold text-sm hover:bg-surface-container-high transition disabled:opacity-60"
            onClick={async () => {
              if (!parsedId) return;
              if (!confirm('确认重发最新一期周报？')) return;
              setBusy('weekly');
              setError(null);
              try {
                await adminResendLatestWeekly(parsedId);
                alert('已触发重发周报。');
              } catch (e) {
                setError(e instanceof Error ? e.message : '操作失败');
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'weekly' ? '发送中…' : '重发周报'}
          </button>
          <button
            disabled={busy !== null}
            className="px-4 py-2 rounded-2xl bg-error-container text-on-error-container font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
            onClick={async () => {
              if (!parsedId) return;
              if (!confirm('确认要将该订阅者退订？')) return;
              setBusy('unsub');
              setError(null);
              try {
                await adminUnsubscribe(parsedId);
                alert('已退订。');
                setSub(await adminSubscriber(parsedId));
              } catch (e) {
                setError(e instanceof Error ? e.message : '操作失败');
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'unsub' ? '处理中…' : '退订'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container font-semibold">
          操作/加载失败：{error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10">
          <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Overview</div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-outline">Created</div>
              <div className="font-semibold mt-1">{sub.created_at}</div>
            </div>
            <div>
              <div className="text-xs text-outline">Confirmed</div>
              <div className="font-semibold mt-1">{sub.confirmed_at ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-outline">Last sent</div>
              <div className="font-semibold mt-1">{sub.last_sent_at ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs text-outline">Send count</div>
              <div className="font-semibold mt-1 tabular-nums">{sub.send_count}</div>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Keywords</div>
            <div className="flex flex-wrap gap-2">
              {sub.keywords.map((k) => (
                <span
                  key={k}
                  className="bg-surface-container-low px-4 py-2 rounded-full text-sm font-medium border border-outline-variant/10"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-primary text-on-primary rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-dim opacity-60" />
          <div className="relative">
            <div className="text-xs font-bold uppercase tracking-widest text-primary-fixed mb-2">
              操作提示
            </div>
            <div className="text-xl font-bold font-headline">冷却与幂等（待接入）</div>
            <p className="text-sm text-inverse-on-surface mt-3 leading-relaxed">
              后续接入真实接口时：重发确认/周报建议加 5 分钟冷却；退订操作保持幂等（已退订再次点击也返回 ok）。
            </p>
          </div>
        </div>
      </div>

      <details className="group bg-surface-container-lowest rounded-3xl border border-outline-variant/10 overflow-hidden">
        <summary className="cursor-pointer list-none px-8 py-6 flex items-center justify-between">
          <div className="font-bold font-headline">RAW KEYWORDS JSON（示例）</div>
          <div className="text-outline group-open:rotate-180 transition">⌄</div>
        </summary>
        <div className="px-8 pb-8">
          <pre className="bg-inverse-surface text-inverse-on-surface p-6 rounded-2xl overflow-x-auto text-sm font-mono leading-relaxed">
{JSON.stringify(sub.keywords, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}

