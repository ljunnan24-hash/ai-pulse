import { Link } from 'react-router-dom';

import { ShortcutButton } from './pwa/ShortcutButton';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto w-full border-t border-slate-100 bg-white px-4 py-10 font-sans md:px-6">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex flex-col gap-1">
          <div className="font-headline text-sm font-bold text-slate-900">AI Pulse</div>
          <p className="text-[0.8125rem] text-slate-500">
            © {year} AI Pulse. <span className="text-slate-400">Curating Intelligence.</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 md:justify-end">
          <Link className="text-slate-500 transition hover:text-primary" to="/subscribe">
            订阅周报
          </Link>
          <ShortcutButton variant="footer" />
          <Link className="text-slate-500 transition hover:text-primary" to="/privacy">
            隐私政策
          </Link>
          <Link className="text-slate-500 transition hover:text-primary" to="/terms">
            服务条款
          </Link>
        </div>
      </div>
    </footer>
  );
}
