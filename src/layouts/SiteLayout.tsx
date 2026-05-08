import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { Footer } from '../components/Footer';

function navActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/weekly/latest') return pathname.startsWith('/weekly');
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const loc = useLocation();
  const active = navActive(loc.pathname, to);
  return (
    <Link to={to} className={`nav-link ${active ? 'nav-link-active' : ''}`}>
      {children}
    </Link>
  );
}

export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-page-canvas selection:bg-primary-container selection:text-on-primary-container">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-2 px-4 md:gap-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
            <Link
              to="/"
              className="font-headline shrink-0 text-base font-bold tracking-tight text-slate-900 md:text-[1.05rem]"
            >
              AI Pulse
            </Link>
            <div className="site-header-nav flex min-w-0 flex-1 items-center gap-x-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:gap-x-1 [&::-webkit-scrollbar]:hidden">
              <NavLink to="/">首页</NavLink>
              <NavLink to="/rankings">排行榜</NavLink>
              <NavLink to="/weekly/latest">周报</NavLink>
              <NavLink to="/archive">归档</NavLink>
              <NavLink to="/about">
                <span className="sm:hidden">关于</span>
                <span className="hidden sm:inline">关于我们</span>
              </NavLink>
            </div>
          </div>
          <Link
            to="/subscribe"
            className="btn-primary shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs shadow-sm sm:px-5 md:text-sm"
          >
            <span className="sm:hidden">订阅</span>
            <span className="hidden sm:inline">订阅周报</span>
          </Link>
        </div>
      </nav>

      <main className="flex-grow px-4 pt-14 md:px-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
