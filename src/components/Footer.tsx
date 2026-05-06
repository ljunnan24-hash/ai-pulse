import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-slate-200 bg-white px-4 py-8 font-sans md:px-6">
      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 text-xs text-slate-500 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="flex flex-col gap-1.5">
          <div className="font-headline text-sm font-semibold text-slate-800">AI Pulse</div>
          <p className="max-w-sm leading-relaxed">每日 AI 信号 · 每周判断报告</p>
          <p className="text-slate-400">© {new Date().getFullYear()} AI Pulse</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
          <Link className="text-slate-600 transition hover:text-primary" to="/#subscribe">
            邮件订阅
          </Link>
          <Link className="text-slate-600 transition hover:text-primary" to="/about">
            关于我们
          </Link>
          <span className="text-slate-400">隐私与条款建设中</span>
        </div>
      </div>
    </footer>
  );
}
