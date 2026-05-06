import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-slate-200/80 bg-white px-6 py-12 font-sans text-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="font-headline text-lg font-bold text-slate-900">AI Pulse</div>
          <p className="max-w-sm text-slate-500">每日 AI 信号榜 · 每周判断报告</p>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} AI Pulse</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 md:justify-end">
          <Link className="text-slate-600 transition hover:text-[#005bc1]" to="/#subscribe">
            邮件订阅
          </Link>
          <Link className="text-slate-600 transition hover:text-[#005bc1]" to="/about">
            关于我们
          </Link>
          <span className="text-slate-400">隐私与条款建设中</span>
        </div>
      </div>
    </footer>
  );
}
