import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ExternalLink, LayoutDashboard, LogOut, MessageSquare, RefreshCw, Rocket, Rss, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { clearAdminToken } from '../auth/adminToken';

type AdminNavItem = {
  to: string;
  end?: boolean;
  label: string;
  caption: string;
  icon: LucideIcon;
};

const navItems: AdminNavItem[] = [
  { to: '/admin', end: true, label: '概览', caption: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/subscribers', label: '订阅者', caption: 'Subscribers', icon: Users },
  { to: '/admin/sources', label: '信源', caption: 'Sources', icon: Rss },
  { to: '/admin/analytics', label: '访问统计', caption: 'Analytics', icon: BarChart3 },
  { to: '/admin/feedback', label: '用户反馈', caption: 'Feedback', icon: MessageSquare },
  { to: '/admin/deploy', label: '部署', caption: 'Deploy', icon: Rocket },
];

const navGroups = [
  { label: '工作台', items: navItems.slice(0, 1) },
  { label: '运营', items: navItems.slice(1, 5) },
  { label: '系统', items: navItems.slice(5) },
];

function currentTitle(pathname: string): string {
  if (pathname.startsWith('/admin/subscribers')) return '订阅者';
  if (pathname.startsWith('/admin/sources')) return '信源';
  if (pathname.startsWith('/admin/analytics')) return '访问统计';
  if (pathname.startsWith('/admin/feedback')) return '用户反馈';
  if (pathname.startsWith('/admin/deploy')) return '部署';
  return '概览';
}

function SidebarLink({ item }: { item: AdminNavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
          isActive
            ? 'bg-[#eef4ff] text-blue-700 shadow-sm ring-1 ring-blue-100'
            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-blue-600" /> : null}
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition ${
              isActive ? 'bg-white text-blue-700 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block leading-tight">{item.label}</span>
            <span className={`block text-[11px] font-medium leading-tight ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>{item.caption}</span>
          </span>
        </>
      )}
    </NavLink>
  );
}

export function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const title = currentTitle(loc.pathname);

  const logout = () => {
    clearAdminToken();
    nav('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white/95 shadow-[1px_0_0_rgba(15,23,42,0.02)] lg:block">
        <div className="flex h-full flex-col px-4 py-5">
          <div className="flex items-center gap-3 px-2 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 font-headline text-sm font-extrabold text-white shadow-sm">
              AP
            </div>
            <div className="min-w-0">
              <div className="font-headline text-lg font-extrabold tracking-tight text-slate-950">AI Pulse</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Admin Console
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group.label}</div>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <SidebarLink key={item.to} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto space-y-3 border-t border-slate-200 pt-4">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4" aria-hidden />
                打开站点
              </span>
              <span className="text-xs text-slate-400">Live</span>
            </a>
            <button
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              退出登录
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
            <div className="min-w-0">
              <div className="font-headline text-base font-extrabold tracking-tight text-slate-950 lg:hidden">AI Pulse Admin</div>
              <div className="hidden items-center gap-2 text-sm lg:flex">
                <span className="font-semibold text-slate-400">Admin</span>
                <span className="text-slate-300">/</span>
                <span className="font-bold text-slate-800">{title}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="hidden h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:inline-flex"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                打开站点
              </a>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                title="刷新当前后台数据"
                onClick={() => window.dispatchEvent(new Event('aipulse-admin-refresh'))}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                刷新
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                onClick={logout}
              >
                退出
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 bg-white/70 px-3 py-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                      isActive ? 'bg-[#eef4ff] text-blue-700 ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1360px] px-4 py-6 md:px-6 md:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
