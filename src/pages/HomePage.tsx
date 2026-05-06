import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, BookOpen, ChevronRight, LineChart, Sparkles, X } from 'lucide-react';
import { apiBase } from '../config';
import { fetchRankings, fetchWeeklyLatest } from '../api/public';
import { HomeTopInfoCards } from '../components/home/HomeTopInfoCards';
import { EmptyState } from '../components/common/EmptyState';
import { estimateReadingMinutes } from '../components/weekly/weeklyPayloadUtils';

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'simple' | 'normal'>('normal');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [top3, setTop3] = useState<Awaited<ReturnType<typeof fetchRankings>>['items']>([]);
  const [rankUpdatedAt, setRankUpdatedAt] = useState<string | null>(null);
  const [topErr, setTopErr] = useState<string | null>(null);
  const [topLoaded, setTopLoaded] = useState(false);
  const [weeklyPreview, setWeeklyPreview] = useState<{
    headline: string;
    summary: string;
    reportDate: string;
    readingMinutes: number;
    titles: string[];
    boundary?: string;
  } | null>(null);
  const [weeklyErr, setWeeklyErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRankings({ range: 'today', category: 'all', limit: 3 })
      .then((r) => {
        setTop3(r.items);
        setRankUpdatedAt(r.updated_at);
        setTopLoaded(true);
      })
      .catch(() => {
        setTopErr('暂时无法加载榜单（请确认后端已运行并已执行 daily_rankings）。');
        setTopLoaded(true);
      });
  }, []);

  useEffect(() => {
    fetchWeeklyLatest()
      .then((r) => {
        const pl = r.payload as Record<string, unknown>;
        const normal = (pl.normal as Record<string, unknown> | undefined) || {};
        const thesis = normal.weekly_thesis as { headline?: string; summary?: string } | undefined;
        const tj = (normal.top3_judgments as Array<{ title?: string }> | undefined) || [];
        const legacy = (normal.top3 as Array<{ title?: string }> | undefined) || [];
        const caps =
          (normal.capability_boundaries as Array<{ question?: string; conclusion?: string }> | undefined) || [];
        const hl = thesis?.headline?.trim();
        const summary = (thesis?.summary ?? '').trim();
        const titles = (tj.length ? tj : legacy).map((x) => String(x.title || '')).filter(Boolean).slice(0, 3);
        const cap0 = caps[0];
        const boundaryLine = cap0?.conclusion?.trim() || cap0?.question?.trim() || '';
        setWeeklyPreview({
          headline: hl || r.title || '',
          summary,
          reportDate: r.report_date || '',
          readingMinutes: estimateReadingMinutes(pl),
          titles,
          boundary: boundaryLine,
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

  const lead = top3[0];
  const pulseNote =
    lead && typeof lead.ranking_score === 'number' && Number.isFinite(lead.ranking_score)
      ? lead.ranking_score.toFixed(1)
      : null;

  return (
    <div className="page-container">
      <header className="section-y">
        <h1 className="font-headline text-[1.85rem] font-extrabold leading-[1.12] tracking-tight text-[#111827] md:text-[2.35rem]">
          每天看 AI 信号，
          <br className="hidden sm:block" />
          每周读 AI 信息摘要
        </h1>
        <p className="mt-5 max-w-2xl text-[0.9375rem] leading-relaxed text-[#666666]">
          我们持续从多个渠道<strong className="font-semibold text-[#111827]">收集、去重与整理</strong>
          AI 领域的关键进展；再用 Pulse Score 做轻量排序参考，并附上简短价值提示，帮助你判断要不要投入时间深入了解。
        </p>
      </header>

      {/* 主模块：今日最值得看的信息 */}
      <section className="section-y">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="heading-section">今日最值得看的信息</h2>
            <p className="mt-1 max-w-2xl text-[0.8125rem] text-[#666666]">
              每条均含事实摘要与价值提示；标题说明「发生了什么」，不会被一句抽象判断替代。
            </p>
          </div>
          <Link to="/rankings" className="text-sm font-medium text-primary hover:underline">
            打开完整信息榜单 →
          </Link>
        </div>
        {topErr ? <p className="mb-4 text-sm text-amber-800">{topErr}</p> : null}
        {!topErr && top3.length > 0 ? <HomeTopInfoCards items={top3} /> : null}
        {!topErr && topLoaded && top3.length === 0 ? (
          <p className="text-sm text-slate-600">暂无榜单数据。请在服务器运行：`python -m app.jobs.daily_rankings`</p>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-10">
          <div className="space-y-4">
            <p className="text-[0.9375rem] leading-relaxed text-[#666666]">
              需要更全的窗口与筛选？在榜单页可按时间范围与分类浏览，所有条目同样以
              <strong className="font-semibold text-[#111827]">信息事实优先</strong>展示。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/rankings" className="btn-primary-lg no-underline">
                查看信息榜单
              </Link>
              <Link
                to="/#subscribe"
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-btn)] border border-primary bg-white px-6 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5 no-underline"
              >
                订阅周报
              </Link>
            </div>
          </div>

          <aside className="rounded-[var(--radius-card)] border border-dashed border-slate-200 bg-slate-50/90 p-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">辅助 · Pulse 排序参考</p>
            {lead && pulseNote ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  当前列表首条 Pulse 为 <span className="font-headline font-semibold tabular-nums text-slate-900">{pulseNote}</span>
                  ，仅用于同类信息之间的相对排序，不代表投资建议或结论。
                </p>
                <Link to={`/events/${lead.id}`} className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
                  打开首条详情 →
                </Link>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                {!topLoaded ? '正在加载…' : '暂无榜单时此处不显示 Pulse。数据就绪后将展示轻量排序参考。'}
              </p>
            )}
          </aside>
        </div>
      </section>

      {/* How it works */}
      <section className="section-y">
        <h2 className="heading-section mb-2">AI Pulse 如何工作</h2>
        <p className="mb-6 max-w-2xl text-muted">先交付可追溯的信息，再叠加轻量辅助判断。</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {[
            { n: '01', icon: LineChart, t: '每日信息榜单', d: '多源收录、去重与结构化摘要。' },
            { n: '02', icon: Activity, t: 'Pulse Score（参考）', d: '新鲜度、可信度、热度与价值的加权示意，用于排序而非结论。' },
            { n: '03', icon: Sparkles, t: '轻量价值提示', d: '在事实之后补充「为什么值得看」「对你意味着什么」。' },
            { n: '04', icon: BookOpen, t: '每周信息摘要', d: '按主题整理一周关键变化与值得继续跟踪的线索。' },
          ].map((step, i, arr) => {
            const Icon = step.icon;
            return (
              <Fragment key={step.n}>
                <div className="card-surface flex flex-1 flex-col p-4 md:p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-white text-primary">
                    <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-4 font-headline text-sm font-semibold leading-snug text-[#111827]">
                    <span className="font-bold text-primary">{step.n}</span>{' '}
                    {step.t}
                  </h3>
                  <p className="mt-2 flex-1 text-[0.8rem] leading-relaxed text-[#666666]">{step.d}</p>
                </div>
                {i < arr.length - 1 ? (
                  <ChevronRight className="hidden h-6 w-6 shrink-0 self-center text-slate-300 lg:block" aria-hidden />
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </section>

      {/* Weekly preview */}
      <section className="section-y">
        <h2 className="heading-section mb-1">本周信息摘要预览</h2>
        <p className="mb-5 text-muted">最新一期周报的结构化整理（若有）。</p>
        {weeklyErr || !weeklyPreview?.headline ? (
          <EmptyState
            title="暂无已发布周报"
            description="订阅后，我们将在每期周报就绪时推送摘要；你也可以稍后在「周报」页查看。"
            actionLabel="订阅周报"
            actionTo="/#subscribe"
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[#D6E8FF] bg-[#F0F7FF] shadow-[var(--shadow-card)]">
            <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_min(40%,220px)] md:items-center md:gap-8 md:p-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#666666]">
                  <span className="rounded-md border border-primary/35 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                    本周信息摘要预览
                  </span>
                  {weeklyPreview.reportDate ? (
                    <time dateTime={weeklyPreview.reportDate}>{weeklyPreview.reportDate}</time>
                  ) : null}
                  <span className="text-slate-300">·</span>
                  <span>阅读约 {weeklyPreview.readingMinutes} 分钟</span>
                </div>
                <h3 className="mt-4 line-clamp-4 font-headline text-xl font-bold leading-snug text-[#111827] [overflow-wrap:anywhere] md:text-2xl md:leading-tight">
                  {weeklyPreview.headline}
                </h3>
                {weeklyPreview.summary ? (
                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#666666]">
                    {weeklyPreview.summary
                      .split(/\n\n+/)
                      .map((para) => para.trim())
                      .filter(Boolean)
                      .map((para, i) => (
                        <p key={i} className={i === 0 ? 'line-clamp-4 md:line-clamp-[5]' : 'line-clamp-3'}>
                          {para}
                        </p>
                      ))}
                  </div>
                ) : weeklyPreview.boundary ? (
                  <p className="mt-4 text-sm leading-relaxed text-[#666666] line-clamp-4">{weeklyPreview.boundary}</p>
                ) : weeklyPreview.titles[0] ? (
                  <p className="mt-4 text-sm leading-relaxed text-[#666666]">{weeklyPreview.titles[0]}</p>
                ) : null}
                <Link to="/weekly/latest" className="btn-primary mt-7 inline-flex no-underline">
                  阅读完整报告 →
                </Link>
              </div>
              <div className="hidden justify-end md:flex" aria-hidden>
                <div className="relative h-36 w-44 shrink-0 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent shadow-inner ring-1 ring-primary/25">
                  <div className="absolute inset-x-4 top-6 h-2 rounded-full bg-white/70 shadow-sm" />
                  <div className="absolute inset-x-6 top-12 space-y-2">
                    <div className="h-1.5 rounded-full bg-white/60" />
                    <div className="h-1.5 w-[85%] rounded-full bg-white/50" />
                  </div>
                  <BookOpen className="absolute bottom-4 right-4 h-10 w-10 text-primary/60" />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Subscribe */}
      <section id="subscribe" className="scroll-mt-28 card-surface section-y p-5 md:p-8">
        <h2 className="heading-section">订阅周报</h2>
        <p className="mt-2 text-muted">
          日报浏览<strong className="font-medium text-slate-800">当日整理后的关键信息</strong>；
          周报阅读<strong className="font-medium text-slate-800">一周主题摘要与线索清单</strong>。
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`filter-chip ${mode === 'simple' ? 'filter-chip-active' : 'filter-chip-inactive'}`}
          >
            简洁
          </button>
          <button
            type="button"
            onClick={() => setMode('normal')}
            className={`filter-chip ${mode === 'normal' ? 'filter-chip-active' : 'filter-chip-inactive'}`}
          >
            标准
          </button>
        </div>

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
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
            className="btn-primary w-full disabled:opacity-60 md:w-auto md:min-w-[12rem]"
          >
            {loading ? '发送中…' : '确认订阅'}
          </button>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </form>
      </section>
    </div>
  );
}
