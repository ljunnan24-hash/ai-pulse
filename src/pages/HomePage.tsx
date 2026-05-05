import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bolt, Filter, X } from 'lucide-react';

import { apiBase } from '../config';
import { fetchRankings } from '../api/public';
import { displayActionSuggestion, displayEventTitle, displayInsightSummary } from '../lib/insightFallback';

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'simple' | 'normal'>('normal');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [top5, setTop5] = useState<Awaited<ReturnType<typeof fetchRankings>>['items']>([]);
  const [topErr, setTopErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRankings({ range: 'today', category: 'all', limit: 5 })
      .then((r) => setTop5(r.items))
      .catch(() => setTopErr('暂时无法加载榜单（请确认后端已运行并已执行 daily_rankings）。'));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('confirmed') === '1') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const addKeyword = (tag: string) => {
    if (keywords.length < 3 && !keywords.includes(tag)) setKeywords([...keywords, tag]);
    inputRef.current?.focus();
  };

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
    <div className="max-w-6xl mx-auto pt-8 pb-20">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container rounded-full mb-4">
          <div className="w-2 h-2 rounded-full bg-surface-tint pulse-dot"></div>
          <span className="text-[0.75rem] font-medium text-on-primary-container uppercase tracking-wider">
            AI Signal → Weekly Judgment
          </span>
        </div>
        <h1 className="font-headline font-extrabold text-5xl md:text-6xl tracking-tighter text-on-surface leading-tight mb-4">
          每天看 AI 信号，每周读 AI 判断
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-8">
          免费浏览每日 Pulse 排行榜与事件解读；订阅邮件获取每周结构化判断报告。
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/rankings"
            className="inline-flex items-center justify-center bg-primary text-surface-container-lowest font-headline font-bold py-3 px-8 rounded-full shadow-lg shadow-primary/15"
          >
            查看今日榜单（免费）
          </Link>
          <Link
            to="/weekly/latest"
            className="inline-flex items-center justify-center bg-primary-container text-on-primary-container font-headline font-bold py-3 px-8 rounded-full"
          >
            本周判断报告
          </Link>
        </div>
      </header>

      <section className="mb-16">
        <h2 className="font-headline font-bold text-2xl text-on-surface mb-6">今日 AI Pulse Top 5</h2>
        {topErr ? <p className="text-sm text-amber-700">{topErr}</p> : null}
        <div className="space-y-4">
          {top5.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 flex flex-col md:flex-row md:items-center gap-4"
            >
              <div className="text-primary font-black text-lg w-8">{idx + 1}</div>
              <div className="flex-1">
                <Link to={`/events/${item.id}`} className="font-headline font-bold text-lg text-on-surface hover:text-primary">
                  {displayEventTitle(item.title)}
                </Link>
                <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                  {displayInsightSummary(item.what_it_means_for_you, item.what_happened)}
                </p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-on-surface-variant">
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest">{item.category}</span>
                  <span>Pulse {item.ranking_score.toFixed(1)}</span>
                  <span>{displayActionSuggestion(item.action_suggestion)}</span>
                </div>
              </div>
            </motion.div>
          ))}
          {!topErr && top5.length === 0 ? (
            <p className="text-sm text-on-surface-variant">暂无榜单数据。请在服务器运行每日任务：`python -m app.jobs.daily_rankings`</p>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <section className="lg:col-span-7 space-y-8">
          <h2 className="font-headline font-bold text-2xl text-on-surface">订阅周报</h2>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('simple')}
              className={`px-4 py-2 rounded-full text-sm font-bold ${mode === 'simple' ? 'bg-primary text-surface-container-lowest' : 'bg-surface-container-low text-on-surface-variant'}`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setMode('normal')}
              className={`px-4 py-2 rounded-full text-sm font-bold ${mode === 'normal' ? 'bg-primary text-surface-container-lowest' : 'bg-surface-container-low text-on-surface-variant'}`}
            >
              Normal
            </button>
          </div>

          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-on-surface"
                placeholder="you@company.com"
                autoCapitalize="none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">Keywords (max 3)</label>
              <div
                className="flex flex-wrap gap-2 min-h-[48px] rounded-xl border border-outline-variant/30 bg-surface-container-low px-2 py-2"
                onClick={() => inputRef.current?.focus()}
              >
                {keywords.map((tag) => (
                  <span
                    key={tag}
                    className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                  >
                    {tag}
                    <X className="w-3 h-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeKeyword(tag); }} />
                  </span>
                ))}
                <input
                  ref={inputRef}
                  className="flex-1 bg-transparent border-none py-2 px-2 outline-none min-w-[120px]"
                  placeholder={keywords.length === 0 ? 'Type keyword + Enter' : ''}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleAddKeyword}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
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
                      body: JSON.stringify({ email: email.trim(), mode, keywords }),
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
                    navigate('/?pending=1');
                  } catch {
                    setFormError('网络错误，请确认 API 可用。');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex-1 bg-primary hover:bg-primary-dim disabled:opacity-60 text-surface-container-lowest font-headline font-bold py-4 px-8 rounded-full"
              >
                {loading ? '发送中…' : '确认订阅'}
              </button>
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          </form>
        </section>

        <aside className="lg:col-span-5 space-y-8">
          <div className="bg-surface-container-low rounded-3xl p-8 border border-outline-variant/5">
            <h3 className="font-headline font-bold text-xl mb-4 text-on-surface">为什么值得看</h3>
            <ul className="space-y-6">
              <li className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-surface-container-lowest rounded-xl flex items-center justify-center text-primary">
                  <Bolt className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">每日信号</h4>
                  <p className="text-sm text-on-surface-variant">排行榜聚合多源 RSS / 官方 / 社区线索。</p>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-surface-container-lowest rounded-xl flex items-center justify-center text-primary">
                  <Filter className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">每周判断</h4>
                  <p className="text-sm text-on-surface-variant">邮件推送结构化周报与可执行建议（中文）。</p>
                </div>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
