import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { apiBase } from '../config';
import { fetchRankings, fetchWeeklyLatest } from '../api/public';
import { HomeTopFiveTable } from '../components/home/HomeTopFiveTable';
import { TodayFocusCard } from '../components/home/TodayFocusCard';
import { EmptyState } from '../components/common/EmptyState';
import { estimateReadingMinutes } from '../components/weekly/weeklyPayloadUtils';
import { formatSlashDateFromIso } from '../lib/homeRankingsDisplay';

function ReportPreviewIllustration() {
  return (
    <div
      className="hidden shrink-0 md:flex h-[220px] w-[220px] items-center justify-center rounded-[28px] border border-[#C7DCFF] bg-[#DCEBFF]"
      aria-hidden
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-[20px] bg-[#C9DCFF]">
        <svg viewBox="0 0 120 120" className="h-[72px] w-[72px] text-[#3B82F6]" fill="none">
          <rect x="22" y="14" width="76" height="92" rx="14" fill="currentColor" opacity="0.14" />
          <path
            d="M38 44h44M38 62h36M38 82l14-12 12 9 20-22"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="85" cy="36" r="6" fill="currentColor" opacity="0.35" />
        </svg>
      </div>
    </div>
  );
}

function StepIconDaily() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
      <path d="M18 8l2 2-2 2M16 10h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepIconPulse() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 18V6M9 18v-5M14 18V9M19 18v-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepIconHint() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 3v4M12 21v-4M4.5 7.5l3 1.5M16.5 16.5l3 1.5M3 12h4M17 12h4M4.5 16.5l3-1.5M16.5 7.5l3-1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function StepIconWeekly() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M7 4h10v16H7z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h4" strokeLinecap="round" />
    </svg>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'simple' | 'normal'>('normal');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [top5, setTop5] = useState<Awaited<ReturnType<typeof fetchRankings>>['items']>([]);
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
    fetchRankings({ range: 'today', category: 'all', limit: 5 })
      .then((r) => {
        setTop5(r.items);
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

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="section-y">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,26.25rem)] lg:items-start lg:gap-12">
          <div className="min-w-0">
            <h1 className="max-w-[520px] font-headline text-[40px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#0F172A] md:text-[64px]">
              每天看 AI 信号，
              <br className="hidden sm:block" />
              每周读 AI 信息摘要
            </h1>
            <p className="mt-5 max-w-[560px] text-[18px] font-normal leading-[1.85] text-[#64748B]">
              AI Pulse 每日追踪全球 AI 产品、模型、工具与行业动态，基于多源数据与 Pulse Score 筛出最值得看的信息，并在每周摘要中整理关键变化。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/rankings"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#1463FF] px-6 text-base font-semibold text-white no-underline transition-opacity hover:opacity-95"
              >
                查看今日榜单
              </Link>
              <Link
                to="/#subscribe"
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#BFD3FF] bg-white px-6 text-base font-semibold text-[#1463FF] no-underline transition-colors hover:bg-[#F8FAFF]"
              >
                订阅周报
              </Link>
            </div>
          </div>
          <TodayFocusCard item={top5[0] ?? null} rankUpdatedAt={rankUpdatedAt} loaded={topLoaded} />
        </div>
      </section>

      {/* Top 5 table */}
      <section className="section-y">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-[40px] font-extrabold leading-[1.2] text-[#0F172A]">今日 AI Pulse Top 5</h2>
            <p className="mt-2 max-w-2xl text-base leading-[1.7] text-[#64748B]">
              基于多源信息与 Pulse Score，筛出今日最值得关注的 5 条 AI 动态。
            </p>
          </div>
          <Link to="/rankings" className="shrink-0 text-base font-bold text-[#2563EB] hover:underline">
            查看完整榜单 →
          </Link>
        </div>
        {topErr ? <p className="mb-4 text-sm text-amber-800">{topErr}</p> : null}
        {!topErr && top5.length > 0 ? <HomeTopFiveTable items={top5} /> : null}
        {!topErr && topLoaded && top5.length === 0 ? (
          <p className="text-sm text-[#64748B]">暂无榜单数据。请在服务器运行：`python -m app.jobs.daily_rankings`</p>
        ) : null}
        <p className="mt-3 text-[13px] leading-snug text-[#94A3B8]">
          Pulse Score 仅用于辅助排序，不代表投资、职业或商业决策建议。
        </p>
      </section>

      {/* How it works */}
      <section className="section-y">
        <h2 className="font-headline text-[40px] font-extrabold text-[#0F172A]">AI Pulse 如何工作</h2>
        <p className="mb-8 mt-2 max-w-2xl text-base text-[#64748B]">
          从海量 AI 动态中提炼信息，用结构化摘要帮助你更快理解变化。
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {[
            {
              n: '01',
              icon: StepIconDaily,
              t: '每日信息榜单',
              d: '汇聚全球多源信号，整理成每日 AI 信息 Top 榜。',
            },
            {
              n: '02',
              icon: StepIconPulse,
              t: 'Pulse Score',
              d: '综合新鲜度、可信度、热度与用户价值，作为排序参考。',
            },
            {
              n: '03',
              icon: StepIconHint,
              t: '轻量信息提示',
              d: '补充「发生了什么」「为什么值得看」「对你意味着什么」。',
            },
            {
              n: '04',
              icon: StepIconWeekly,
              t: '每周信息摘要',
              d: '每周整理关键变化、工具线索与值得继续跟踪的方向。',
            },
          ].map((step, i, arr) => {
            const Icon = step.icon;
            return (
              <Fragment key={step.n}>
                <div className="flex min-h-[168px] flex-1 flex-col rounded-[20px] border border-[#E9EEF6] bg-white p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#2563EB]/20 bg-white text-[#2563EB]">
                    <Icon />
                  </div>
                  <p className="mt-4 text-[14px] font-bold text-[#2563EB]">{step.n}</p>
                  <h3 className="mt-1 font-headline text-[18px] font-bold leading-snug text-[#0F172A]">{step.t}</h3>
                  <p className="mt-2 flex-1 text-[14px] leading-[1.75] text-[#64748B]">{step.d}</p>
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
        <h2 className="font-headline text-[40px] font-extrabold leading-[1.2] text-[#0F172A]">本周信息摘要预览</h2>
        <p className="mb-6 mt-2 text-base leading-[1.7] text-[#64748B]">最新一期周报的结构化整理。</p>
        {weeklyErr || !weeklyPreview?.headline ? (
          <EmptyState
            title="暂无已发布周报"
            description="订阅后，我们将在每期周报就绪时推送摘要；你也可以稍后在「周报」页查看。"
            actionLabel="订阅周报"
            actionTo="/#subscribe"
          />
        ) : (
          <div className="min-h-[280px] overflow-hidden rounded-[24px] border border-[#D8E8FF] bg-[#EEF5FF] shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="grid gap-10 px-6 py-8 md:grid-cols-[1.8fr_0.8fr] md:items-center md:gap-10 md:px-10 md:py-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] font-medium text-[#64748B]">
                  <span className="rounded-full border border-[#CFE0FF] bg-white px-[10px] py-[6px] text-[13px] font-bold text-[#2563EB]">
                    本周信息摘要预览
                  </span>
                  {weeklyPreview.reportDate ? (
                    <time dateTime={weeklyPreview.reportDate}>{formatSlashDateFromIso(weeklyPreview.reportDate)}</time>
                  ) : null}
                  <span className="text-[#CBD5E1]">·</span>
                  <span>阅读约 {weeklyPreview.readingMinutes} 分钟</span>
                </div>
                <h3 className="mt-6 line-clamp-3 max-w-[900px] font-headline text-[clamp(1.75rem,4.5vw,3.5rem)] font-extrabold leading-[1.18] tracking-[-0.02em] text-[#0F172A] [overflow-wrap:anywhere]">
                  {weeklyPreview.headline}
                </h3>
                {weeklyPreview.summary ? (
                  <div className="mt-5 max-w-[820px] space-y-0 text-base font-normal leading-[1.9] text-[#64748B]">
                    {weeklyPreview.summary
                      .split(/\n\n+/)
                      .map((para) => para.trim())
                      .filter(Boolean)
                      .slice(0, 1)
                      .map((para, i) => (
                        <p key={i} className="line-clamp-3">
                          {para}
                        </p>
                      ))}
                  </div>
                ) : weeklyPreview.boundary ? (
                  <p className="mt-5 max-w-[820px] text-base leading-[1.9] text-[#64748B] line-clamp-3">{weeklyPreview.boundary}</p>
                ) : weeklyPreview.titles[0] ? (
                  <p className="mt-5 max-w-[820px] text-base leading-[1.9] text-[#64748B]">{weeklyPreview.titles[0]}</p>
                ) : null}
                <Link
                  to="/weekly/latest"
                  className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#1463FF] px-[22px] text-base font-bold text-white no-underline transition-opacity hover:opacity-95"
                >
                  阅读完整报告 →
                </Link>
              </div>
              <ReportPreviewIllustration />
            </div>
          </div>
        )}
      </section>

      {/* Subscribe */}
      <section
        id="subscribe"
        className="scroll-mt-28 section-y rounded-2xl border border-slate-200/70 bg-slate-50/70 p-6 md:p-8"
      >
        <h2 className="font-headline text-2xl font-bold text-slate-800">订阅周报</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
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
