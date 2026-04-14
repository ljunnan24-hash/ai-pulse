import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearAdminToken } from '../auth/adminToken';
import { LayoutDashboard, LogOut, RefreshCw, Users } from 'lucide-react';

const linkBase =
  'flex items-center gap-3 px-3 py-2 rounded-xl transition-colors font-medium';

export function AdminLayout() {
  const nav = useNavigate();
  return (
    <div className="bg-background text-on-surface min-h-screen flex">
      {/* Side nav */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-outline-variant/20 bg-surface-container-lowest">
        <div className="w-full p-4 flex flex-col">
          <div className="px-2 py-4">
            <div className="font-headline text-lg font-extrabold tracking-tight text-on-surface">
              AI Pulse Admin
            </div>
            <div className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mt-1">
              Management Console
            </div>
          </div>

          <nav className="mt-4 flex flex-col gap-1">
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-primary-container/40 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`
              }
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </NavLink>
            <NavLink
              to="/admin/subscribers"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-primary-container/40 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`
              }
            >
              <Users className="w-5 h-5" />
              Subscribers
            </NavLink>
          </nav>

          <div className="mt-auto pt-4 border-t border-outline-variant/20">
            <button
              className={`${linkBase} w-full text-on-surface-variant hover:bg-surface-container-low`}
              onClick={() => {
                clearAdminToken();
                nav('/admin/login', { replace: true });
              }}
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-40 h-16 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden font-headline font-extrabold tracking-tight">
              AI Pulse Admin
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-xl hover:bg-surface-container-low active:scale-95 transition"
              title="Refresh"
              onClick={() => window.dispatchEvent(new Event('aipulse-admin-refresh'))}
            >
              <RefreshCw className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

