import { Link, Outlet, useLocation } from 'react-router-dom';

import { Footer } from '../components/Footer';

export function SiteLayout() {
  const loc = useLocation();
  const active = (path: string) =>
    path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fc] selection:bg-primary-container selection:text-on-primary-container">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 font-headline shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 md:px-6">
          <div className="flex flex-wrap items-center gap-6 md:gap-10">
            <Link to="/" className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
              AI Pulse
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-sm md:gap-6">
              <Link
                to="/rankings"
                className={`rounded-lg px-2 py-1 text-sm font-semibold transition-colors ${
                  active('/rankings') ? 'text-[#005bc1]' : 'text-slate-600 hover:text-[#005bc1]'
                }`}
              >
                排行榜
              </Link>
              <Link
                to="/weekly/latest"
                className={`rounded-lg px-2 py-1 text-sm font-semibold transition-colors ${
                  active('/weekly') ? 'text-[#005bc1]' : 'text-slate-600 hover:text-[#005bc1]'
                }`}
              >
                周报
              </Link>
              <Link
                to="/archive"
                className={`rounded-lg px-2 py-1 text-sm font-semibold transition-colors ${
                  active('/archive') ? 'text-[#005bc1]' : 'text-slate-600 hover:text-[#005bc1]'
                }`}
              >
                归档
              </Link>
              <Link
                to="/about"
                className={`rounded-lg px-2 py-1 text-sm font-semibold transition-colors ${
                  active('/about') ? 'text-[#005bc1]' : 'text-slate-600 hover:text-[#005bc1]'
                }`}
              >
                关于我们
              </Link>
            </div>
          </div>
          <Link
            to="/#subscribe"
            className="rounded-full bg-[#005bc1] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#004a9e] md:px-5"
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
