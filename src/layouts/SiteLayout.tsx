import { Link, Outlet, useLocation } from 'react-router-dom';
import { Footer } from '../components/Footer';

export function SiteLayout() {
  const loc = useLocation();
  const active = (path: string) =>
    path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);

  return (
    <div className="min-h-screen flex flex-col bg-surface selection:bg-primary-container selection:text-on-primary-container">
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm font-headline">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-black tracking-tighter text-on-surface">
              AI Pulse
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                className={`text-on-surface font-medium hover:text-primary transition-colors ${active('/') && loc.pathname === '/' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
              >
                Home
              </Link>
              <Link
                to="/rankings"
                className={`text-on-surface font-medium hover:text-primary transition-colors ${active('/rankings') ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
              >
                Rankings
              </Link>
              <Link
                to="/weekly/latest"
                className={`text-on-surface font-medium hover:text-primary transition-colors ${active('/weekly') ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
              >
                Weekly
              </Link>
              <Link
                to="/archive"
                className={`text-on-surface font-medium hover:text-primary transition-colors ${active('/archive') ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
              >
                Archive
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-20 px-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
