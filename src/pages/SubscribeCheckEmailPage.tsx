import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/** 提交订阅 API 成功后：引导用户去邮箱点击确认链接。 */
export default function SubscribeCheckEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const e = window.sessionStorage.getItem('aipulse_last_subscribe_email');
    if (!e) {
      navigate('/subscribe', { replace: true });
      return;
    }
    setEmail(e);
  }, [navigate]);

  if (!email) {
    return null;
  }

  return (
    <div className="page-container">
      <header className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-slate-900 md:text-3xl">请查收邮件</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          我们已向 <span className="font-semibold text-slate-800">{email}</span> 发送确认邮件。请打开收件箱（或垃圾箱），点击邮件中的「确认订阅」链接以完成订阅。
        </p>
      </header>

      <div className="card-surface max-w-xl space-y-5 p-5 md:p-8">
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-600">
          <li>邮件标题或发件人可能含「AI Pulse」「确认订阅」等字样。</li>
          <li>若数分钟内未收到，请检查垃圾邮件文件夹。</li>
          <li>确认前不会发送周报；确认后即可按设定接收邮件。</li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/" className="btn-primary inline-flex min-w-[10rem] items-center justify-center no-underline">
            返回首页
          </Link>
          <Link
            to="/subscribe"
            className="inline-flex min-w-[10rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 no-underline hover:bg-slate-50"
          >
            修改邮箱重试
          </Link>
        </div>
      </div>
    </div>
  );
}
