import { Link } from 'react-router-dom';

/** 邮件退订链接跳转：明确告知已退订。 */
export default function SubscribeUnsubscribedPage() {
  return (
    <div className="page-container">
      <header className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-slate-900 md:text-3xl">已取消邮件订阅</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          你的邮箱已从 AI Pulse 周报邮件列表中移除，之后不会再收到订阅类邮件。
        </p>
      </header>

      <div className="card-surface max-w-xl space-y-5 p-5 md:p-8">
        <p className="text-sm leading-relaxed text-slate-600">
          若你希望再次接收周报，可在本站重新填写订阅并到邮箱完成确认。
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/" className="btn-primary inline-flex min-w-[10rem] items-center justify-center no-underline">
            返回首页
          </Link>
          <Link
            to="/subscribe"
            className="inline-flex min-w-[10rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 no-underline hover:bg-slate-50"
          >
            重新订阅
          </Link>
        </div>
      </div>
    </div>
  );
}
