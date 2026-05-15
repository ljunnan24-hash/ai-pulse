import { useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { apiBase } from '../config';

/**
 * 独立订阅页：从首页移出完整表单，保持产品首页轻量。
 */
export default function SubscribePage() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddKeyword = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim() && keywords.length < 3) {
      if (!keywords.includes(inputValue.trim())) setKeywords([...keywords, inputValue.trim()]);
      setInputValue('');
    }
  };

  const removeKeyword = (tag: string) => {
    setKeywords(keywords.filter((k) => k !== tag));
    inputRef.current?.focus();
  };

  return (
    <div className="page-container">
      <header className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-slate-900 md:text-3xl">订阅周报</h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          日报浏览当日整理后的关键信息；周报阅读一周主题摘要与线索清单。
        </p>
      </header>

      <div className="card-surface max-w-xl p-5 md:p-8">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="sub-email">
              邮箱
            </label>
            <input
              id="sub-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-surface px-3 py-2.5 text-sm text-slate-900 outline-none ring-primary/20 focus:ring-2"
              placeholder="you@company.com"
              autoCapitalize="none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">关键词（最多 3 个）</label>
            <div
              className="flex min-h-[44px] flex-wrap gap-2 rounded-lg border border-slate-200 bg-surface px-2 py-2"
              onClick={() => inputRef.current?.focus()}
            >
              {keywords.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 rounded-md border border-primary/15 bg-primary/5 px-2 py-1 text-xs font-medium text-primary"
                >
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeKeyword(tag); }} />
                </span>
              ))}
              <input
                ref={inputRef}
                className="min-w-[120px] flex-1 border-none bg-transparent py-1.5 px-2 text-sm outline-none"
                placeholder={keywords.length === 0 ? '输入后按 Enter' : ''}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleAddKeyword}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setFormError(null);
              if (!email.trim()) {
                setFormError('请输入有效邮箱。');
                return;
              }
              setLoading(true);
              try {
                const res = await fetch(`${apiBase()}/api/subscribe`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: email.trim(), mode: 'normal', keywords }),
                });
                const data = res.ok ? null : await res.json().catch(() => null);
                if (!res.ok) {
                  let msg = `请求失败 (${res.status})`;
                  if (data && typeof data === 'object' && 'detail' in data) {
                    const d = (data as { detail: unknown }).detail;
                    msg = typeof d === 'string' ? d : JSON.stringify(d);
                  }
                  setFormError(msg);
                  return;
                }
                window.sessionStorage.setItem('aipulse_last_subscribe_email', email.trim());
                navigate('/subscribe/check-email');
              } catch {
                setFormError('网络错误，请确认 API 可用。');
              } finally {
                setLoading(false);
              }
            }}
            className="btn-primary w-full disabled:opacity-60 md:w-auto md:min-w-[12rem]"
          >
            {loading ? '发送中…' : '确认订阅'}
          </button>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <p className="border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-500">
            提交订阅即表示您已阅读并同意
            <Link to="/privacy" className="mx-1 font-medium text-[#2563EB] underline-offset-2 hover:underline">
              《隐私政策》
            </Link>
            与
            <Link to="/terms" className="mx-1 font-medium text-[#2563EB] underline-offset-2 hover:underline">
              《服务条款》
            </Link>
            中对个人信息处理与邮件服务的约定。
          </p>
        </form>
      </div>
    </div>
  );
}
