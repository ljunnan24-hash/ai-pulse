import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, User } from 'lucide-react';
import { adminLogin } from '../api/client';
import { setAdminToken } from '../auth/adminToken';
import { AdminButton, AdminError } from '../components/AdminUI';

export function AdminLoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = useMemo(() => {
    const s = loc.state as unknown;
    if (s && typeof s === 'object' && 'from' in s && typeof (s as { from: unknown }).from === 'string') {
      return (s as { from: string }).from;
    }
    return '/admin';
  }, [loc.state]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('请输入用户名和密码。');
      return;
    }
    setLoading(true);
    try {
      const out = await adminLogin(username.trim(), password);
      setAdminToken(out.access_token);
      nav(from, { replace: true });
    } catch {
      setError('登录失败：用户名或密码不正确，或后端未启动。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <section className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden />
              Internal console
            </div>
            <h1 className="mt-5 font-headline text-4xl font-extrabold tracking-tight text-slate-950">AI Pulse Admin</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              管理订阅者、访问统计和用户反馈，适合日常运营时快速定位问题、确认数据状态、执行必要动作。
            </p>
            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <dt className="text-xs font-semibold text-slate-500">Subscribers</dt>
                <dd className="mt-2 text-sm font-bold text-slate-950">订阅状态</dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <dt className="text-xs font-semibold text-slate-500">Analytics</dt>
                <dd className="mt-2 text-sm font-bold text-slate-950">访问趋势</dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <dt className="text-xs font-semibold text-slate-500">Feedback</dt>
                <dd className="mt-2 text-sm font-bold text-slate-950">反馈处理</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/70">
            <div className="mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 font-headline text-sm font-extrabold text-white">AP</div>
              <h2 className="mt-4 font-headline text-2xl font-extrabold tracking-tight text-slate-950">登录后台</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">AI Pulse 管理控制台</p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="username">
                  用户名
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="admin"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="password">
                  密码
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="输入密码"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error ? <AdminError>{error}</AdminError> : null}

              <AdminButton type="submit" variant="primary" disabled={loading} className="w-full">
                {loading ? '登录中…' : '登录'}
              </AdminButton>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-4 text-xs font-medium text-slate-500">Internal system access only</div>
          </section>
        </div>
      </main>
    </div>
  );
}
