import { useEffect, useState } from 'react';
import { RefreshCw, Rocket } from 'lucide-react';

import type { AdminDeployResult, AdminDeployStatus } from '../api/client';
import { adminDeployRun, adminDeployStatus } from '../api/client';
import { AdminButton, AdminError, AdminPageHeader, AdminPanel, AdminStatCard, AdminStatusBadge } from '../components/AdminUI';

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('zh-CN');
}

function resultStatus(result: AdminDeployResult | null): string {
  if (!result) return 'no_data';
  return result.ok ? 'ok' : 'failing';
}

export function AdminDeployPage() {
  const [status, setStatus] = useState<AdminDeployStatus | null>(null);
  const [result, setResult] = useState<AdminDeployResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const s = await adminDeployStatus();
      setStatus(s);
      setResult(s.last_result);
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

  const runDeploy = async () => {
    if (!confirm('确认执行服务器部署脚本？')) return;
    setRunning(true);
    setError(null);
    try {
      const out = await adminDeployRun();
      setResult(out);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '部署失败');
    } finally {
      setRunning(false);
    }
  };

  const canRun = Boolean(status?.enabled && status.configured && status.available && !status.running && !running);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Release Operations"
        title="部署"
        description="触发服务器上预先配置的部署脚本，执行结果会返回脚本输出。"
        actions={
          <>
            <AdminButton onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              刷新
            </AdminButton>
            <AdminButton variant="primary" disabled={!canRun} onClick={() => void runDeploy()}>
              <Rocket className="h-4 w-4" aria-hidden />
              {running || status?.running ? '部署中…' : '执行部署'}
            </AdminButton>
          </>
        }
      />

      {error ? <AdminError>{error}</AdminError> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <AdminStatCard label="开关" value={status?.enabled ? 'Enabled' : 'Disabled'} tone={status?.enabled ? 'emerald' : 'slate'} />
        <AdminStatCard label="脚本" value={status?.available ? 'Ready' : 'Missing'} tone={status?.available ? 'emerald' : 'amber'} />
        <AdminStatCard label="运行中" value={status?.running || running ? 'Yes' : 'No'} tone={status?.running || running ? 'amber' : 'blue'} />
        <AdminStatCard label="上次结果" value={result?.ok ? 'Success' : result ? 'Failed' : '—'} tone={result?.ok ? 'emerald' : result ? 'rose' : 'slate'} />
      </div>

      <AdminPanel title="部署配置">
        <div className="grid gap-3 p-4 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-500">状态</div>
            <div className="mt-1"><AdminStatusBadge status={status?.available ? 'ok' : 'no_data'} /></div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">超时</div>
            <div className="mt-1 font-semibold text-slate-950">{status?.timeout_seconds ?? '—'}s</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-500">脚本路径</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-700">{status?.script_path || '未配置'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-500">工作目录</div>
            <div className="mt-1 break-all font-mono text-xs text-slate-700">{status?.workdir || '脚本所在目录'}</div>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel title="最近一次执行" description={result ? `${formatDate(result.started_at)} → ${formatDate(result.finished_at)}` : '暂无部署记录。'}>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <AdminStatusBadge status={resultStatus(result)} />
            <span className="text-sm text-slate-600">exit: {result?.exit_code ?? '—'}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">stdout</div>
              <pre className="max-h-[360px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">{result?.stdout || '—'}</pre>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">stderr</div>
              <pre className="max-h-[360px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">{result?.stderr || '—'}</pre>
            </div>
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
