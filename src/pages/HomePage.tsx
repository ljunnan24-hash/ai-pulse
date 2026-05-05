import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Filter, LineChart, Sparkles, X } from 'lucide-react';

import { apiBase } from '../config';
import { fetchRankings, fetchWeeklyLatest } from '../api/public';
import { RankingCard } from '../components/rankings/RankingCard';
import { EmptyState } from '../components/common/EmptyState';

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
  const [weeklyPreview, setWeeklyPreview] = useState<{
    headline: string;
    titles: string[];
    boundary?: string;
  } | null>(null);
  const [weeklyErr, setWeeklyErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRankings({ range: 'today', category: 'all', limit: 5 })
      .then((r) => setTop5(r.items))
      .catch(() => setTopErr('暂时无法加载榜单（请确认后端已运行并已执行 daily_rankings）。'));
  }, []);

  useEffect(() => {
    fetchWeeklyLatest()
      .then((r) => {
        const pl = r.payload as Record<string, unknown>;
        const normal = (pl.normal as Record<string, unknown> | undefined) || {};
        const thesis = normal.weekly_thesis as { headline?: string } | undefined;
        const tj = (normal.top3_judgments as Array<{ title?: string }> | undefined) || [];
        const legacy = (normal.top3 as Array<{ title?: string }> | undefined) || [];
        const caps = (normal.capability_boundaries as Array<{ question?: string }> | undefined) || [];
        const hl = thesis?.headline?.trim();
        const titles = (tj.length ? tj : legacy).map((x) => String(x.title || '')).filter(Boolean).slice(0, 3);
        setWeeklyPreview({
          headline: hl || r.title || '',
          titles,
          boundary: caps[0]?.question,
        });
        setWeeklyErr(false);
      })
      .catch(() => {
        setWeeklyErr(true);
        setWeeklyPreview(null);
      });
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
    <div className="mx-auto max-w-6xl pb-20 pt-6 md:pt-10">
      {/* Hero */}
      <header className="mb-16 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#005bc1]/20 bg-white px-3 py-1 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-[#005bc1] pulse-dot" />
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-[#005bc1]">
              Signal · Judgment · Action
            </span>
          </div>
          <h1 className="font-headline text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 md:text-5xl lg:text-[3.25rem]">
            每天看 AI 信号，每周读 AI 判断
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            AI Pulse 每日追踪全球 AI 动态，用 Pulse Score 排出最值得关注的事件，并在每周报告中告诉你：
            <strong className="font-semibold text-slate-800">什么值得投入，什么可以忽略。</strong>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/rankings"
              className="inline-flex items-center justify-center rounded-full bg-[#005bc1] px-7 py-3 font-headline text-sm font-bold text-white shadow-[0_8px_24px_rgba(0,91,193,0.25)] transition hover:bg-[#004a9e]"
            >
              查看今日榜单（免费）
            </Link>
            <Link
              to="/#subscribe"
              className="inline-flex items-center justify-center rounded-full border-2 border-[#005bc1] bg-white px-7 py-3 font-headline text-sm font-bold text-[#005bc1] transition hover:bg-slate-50"
            >
              订阅周报
            </Link>
          </div>
        </div>
        <div className="relative flex min-h-[220px] items-center justify-center rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-[#005bc1]/[0.06] to-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_30%_20%,rgba(0,91,193,0.12),transparent_55%)]" />
          <div className="relative grid grid-cols-3 gap-3 md:gap-4">
            {[0.92, 0.78, 0.65].map((op, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="h-24 w-20 rounded-2xl bg-white/90 shadow-md ring-1 ring-slate-200/80 md:h-28 md:w-24"
                style={{ opacity: op }}
              />
            ))}
          </div>
          <Sparkles className="absolute right-6 top-6 h-8 w-8 text-[#005bc1]/40" aria-hidden />
        </div>
      </header>

      {/* Top 5 */}
      <section className="mb-20">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-bold text-slate-900 md:text-3xl">今日 AI Pulse Top 5</h2>
            <p className="mt-1 text-sm text-slate-600">基于多源聚合与 Pulse Score，今日最值得关注的信号。</p>
          </div>
          <Link to="/rankings" className="text-sm font-semibold text-[#005bc1] hover:underline">
            查看完整榜单 →
          </Link>
        </div>
        {topErr ? <p className="text-sm text-amber-800">{topErr}</p> : null}
        <div className="space-y-4">
          {top5.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <RankingCard rank={idx + 1} item={item} variant="compact" />
            </motion.div>
          ))}
          {!topErr && top5.length === 0 ? (
            <p className="text-sm text-slate-600">暂无榜单数据。请在服务器运行每日任务：`python -m app.jobs.daily_rankings`</p>
          ) : null}
        </div>
      </section>

      {/* How it works */}
      <section className="mb-20">
        <h2 className="mb-8 font-headline text-2xl font-bold text-slate-900 md:text-3xl">AI Pulse 如何工作</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#005bc1]/10 text-[#005bc1]">
              <LineChart className="h-5 w-5" />
            </div>
            <h3 className="font-headline text-lg font-bold text-slate-900">每日排行榜</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              免费查看当天最重要的 AI 事件，快速知道 AI 圈发生了什么。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#005bc1]/10 text-[#005bc1]">
              <Filter className="h-5 w-5" />
            </div>
            <h3 className="font-headline text-lg font-bold text-slate-900">事件详情</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              查看事件来源、评分依据、影响判断，避免只看标题做决定。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#005bc1]/10 text-[#005bc1]">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="font-headline text-lg font-bold text-slate-900">每周判断报告</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              从一周事件中提炼趋势、能力边界、工具机会和可忽略噪音。
            </p>
          </div>
        </div>
      </section>

      {/* Weekly preview */}
      <section className="mb-20">
        <h2 className="mb-6 font-headline text-2xl font-bold text-slate-900 md:text-3xl">本周判断报告预览</h2>
        {weeklyErr || !weeklyPreview?.headline ? (
          <EmptyState
            title="暂无已发布周报"
            description="订阅后，我们将在每期周报就绪时推送摘要链接；你也可以稍后在「周报」页查看。"
            actionLabel="订阅周报"
            actionTo="/#subscribe"
          />
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#005bc1]">一句话判断</p>
            <p className="mt-3 font-headline text-xl font-bold leading-snug text-slate-900 md:text-2xl">{weeklyPreview.headline}</p>
            {weeklyPreview.titles.length > 0 ? (
              <ul className="mt-6 space-y-2 border-t border-slate-100 pt-6">
                <li className="text-xs font-semibold uppercase tracking-wide text-slate-500">本周重点判断</li>
                {weeklyPreview.titles.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="font-bold text-[#005bc1]">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {weeklyPreview.boundary ? (
              <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">能力边界示例：</span>
                {weeklyPreview.boundary}
              </p>
            ) : null}
            <Link
              to="/weekly/latest"
              className="mt-8 inline-flex rounded-full bg-[#005bc1] px-6 py-2.5 font-headline text-sm font-bold text-white"
            >
              阅读完整周报
            </Link>
          </div>
        )}
      </section>

      {/* Subscribe */}
      <section id="subscribe" className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <h2 className="font-headline text-2xl font-bold text-slate-900">订阅周报</h2>
        <p className="mt-2 text-sm text-slate-600">
          排行榜告诉你今天发生了什么；周报告诉你这一周<strong className="text-slate-800">真正值得投入什么</strong>。
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'simple' ? 'bg-[#005bc1] text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode('normal')}
            className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'normal' ? 'bg-[#005bc1] text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Normal
          </button>
        </div>

        <form
          className="mt-8 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-[#f7f9fc] px-4 py-3 text-slate-900 outline-none ring-[#005bc1]/20 focus:ring-2"
              placeholder="you@company.com"
              autoCapitalize="none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">关键词（最多 3 个）</label>
            <div
              className="flex min-h-[48px] flex-wrap gap-2 rounded-xl border border-slate-200 bg-[#f7f9fc] px-2 py-2"
              onClick={() => inputRef.current?.focus()}
            >
              {keywords.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-2 rounded-full bg-[#005bc1]/10 px-3 py-1 text-sm font-medium text-[#004291]"
                >
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeKeyword(tag); }} />
                </span>
              ))}
              <input
                ref={inputRef}
                className="min-w-[120px] flex-1 border-none bg-transparent py-2 px-2 outline-none"
                placeholder={keywords.length === 0 ? '输入关键词后按 Enter' : ''}
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
            className="w-full rounded-full bg-[#005bc1] py-4 font-headline font-bold text-white hover:bg-[#004a9e] disabled:opacity-60 md:w-auto md:px-12"
          >
            {loading ? '发送中…' : '确认订阅'}
          </button>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </form>
      </section>
    </div>
  );
}
