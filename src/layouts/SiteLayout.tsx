import { Link, Outlet, useLocation } from 'react-router-dom';

import { Footer } from '../components/Footer';

function navActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/weekly/latest') return pathname.startsWith('/weekly');
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavLink({ to, children }: { to: string; children: string }) {
  const loc = useLocation();
  const active = navActive(loc.pathname, to);
  return (
    <Link
      to={to}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'bg-[#005bc1]/12 text-[#005bc1] ring-1 ring-[#005bc1]/25'
          : 'text-slate-600 hover:bg-slate-50 hover:text-[#005bc1]'
      }`}
    >
      {children}
    </Link>
  );
}

export function SiteLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fc] selection:bg-primary-container selection:text-on-primary-container">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 font-headline shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-8">
            <Link to="/" className="shrink-0 text-lg font-black tracking-tight text-slate-900 md:text-xl">
              AI Pulse
            </Link>
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              <NavLink to="/rankings">排行榜</NavLink>
              <NavLink to="/weekly/latest">周报</NavLink>
              <NavLink to="/archive">归档</NavLink>
              <NavLink to="/about">关于我们</NavLink>
            </div>
          </div>
          <Link
            to="/#subscribe"
            className="shrink-0 rounded-full bg-[#005bc1] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-[#004a9e] md:px-5 md:text-sm"
          >
            订阅周报
          </Link>
        </div>
      </nav>

      <main className="flex-grow px-4 pt-[4.25rem] md:px-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
