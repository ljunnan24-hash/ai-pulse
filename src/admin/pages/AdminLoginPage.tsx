import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setAdminToken } from '../auth/adminToken';
import { Lock, User } from 'lucide-react';
import { adminLogin } from '../api/client';

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
    <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary-container/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-container/40 mb-4">
            <span className="font-headline font-extrabold text-primary text-lg">AP</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">
            AI Pulse Admin
          </h1>
          <p className="font-medium text-on-surface-variant uppercase tracking-widest text-sm">
            Management Console
          </p>
        </div>

        <div className="bg-surface-container-lowest p-10 rounded-3xl shadow-[0px_12px_40px_rgba(25,28,30,0.04)] border border-outline-variant/10">
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-outline" />
                </div>
                <input
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3 bg-surface-container-low border border-transparent focus:border-primary focus:ring-0 rounded-2xl text-sm font-medium placeholder:text-outline/50"
                  placeholder="admin"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-outline" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3 bg-surface-container-low border border-transparent focus:border-primary focus:ring-0 rounded-2xl text-sm font-medium placeholder:text-outline/50"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error ? (
              <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-sm font-semibold">
                {error}
              </div>
            ) : null}

            <button
              className="w-full py-4 rounded-2xl text-on-primary font-bold text-base shadow-[0px_12px_40px_rgba(25,28,30,0.04)] bg-gradient-to-br from-primary to-primary-dim hover:scale-[0.99] active:scale-[0.97] transition disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? '登录中…' : 'Login'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-outline-variant/10 text-center">
            <p className="text-xs text-on-surface-variant font-medium">Internal System Access Only</p>
          </div>
        </div>
      </div>
    </div>
  );
}

