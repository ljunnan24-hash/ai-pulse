import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ExternalLink, LayoutDashboard, LogOut, MessageSquare, RefreshCw, Users } from 'lucide-react';
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
  { to: '/admin/analytics', label: '访问统计', caption: 'Analytics', icon: BarChart3 },
  { to: '/admin/feedback', label: '用户反馈', caption: 'Feedback', icon: MessageSquare },
];

function currentTitle(pathname: string): string {
  if (pathname.startsWith('/admin/subscribers')) return '订阅者';
  if (pathname.startsWith('/admin/analytics')) return '访问统计';
  if (pathname.startsWith('/admin/feedback')) return '用户反馈';
  return '概览';
}

function SidebarLink({ item }: { item: AdminNavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
          isActive
            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block leading-tight">{item.label}</span>
        <span className="block text-[11px] font-medium leading-tight text-slate-400">{item.caption}</span>
      </span>
    </NavLink>
  );
}

export function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();

  const logout = () => {
    clearAdminToken();
    nav('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col p-4">
          <div className="px-2 py-3">
            <div className="font-headline text-lg font-extrabold tracking-tight text-slate-950">AI Pulse</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Console</div>
          </div>

          <nav className="mt-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </nav>

          <div className="mt-auto border-t border-slate-200 pt-4">
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              退出登录
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
            <div className="min-w-0">
              <div className="font-headline text-base font-extrabold tracking-tight text-slate-950 lg:hidden">AI Pulse Admin</div>
              <div className="hidden text-sm font-semibold text-slate-700 lg:block">{currentTitle(loc.pathname)}</div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="hidden h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                打开站点
              </a>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                title="刷新当前后台数据"
                onClick={() => window.dispatchEvent(new Event('aipulse-admin-refresh'))}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                刷新
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:hidden"
                onClick={logout}
              >
                退出
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
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

        <main className="mx-auto w-full max-w-[1280px] px-4 py-5 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
