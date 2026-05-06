import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, BookOpen, LineChart, Sparkles, X } from 'lucide-react';

import { apiBase } from '../config';
import type { EventDetailResponse } from '../api/public';
import { fetchEventDetail, fetchRankings, fetchWeeklyLatest } from '../api/public';
import { ActionBadge } from '../components/common/ActionBadge';
import { ScoreBadge } from '../components/common/ScoreBadge';
import { RankingCard } from '../components/rankings/RankingCard';
import { EmptyState } from '../components/common/EmptyState';
import { estimateReadingMinutes } from '../components/weekly/weeklyPayloadUtils';

function fmtScore(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(1);
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
  const [leadDetail, setLeadDetail] = useState<EventDetailResponse | null>(null);
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
    const id = top5[0]?.id;
    if (!id) {
      setLeadDetail(null);
      return;
    }
    fetchEventDetail(id)
      .then(setLeadDetail)
      .catch(() => setLeadDetail(null));
  }, [top5]);

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

  const lead = top5[0];
  const br = leadDetail?.score_breakdown;
  const judgmentLine =
    (lead?.one_liner ?? '').trim() ||
    (topLoaded ? '暂无一句话判断，请查看下方列表或完整榜单。' : '正在加载…');

  return (
    <div className="page-container">
      {/* Hero */}
      <header className="section-y grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
        <div>
          <h1 className="font-headline text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 md:text-[2.25rem] md:leading-[1.15]">
            每天看 AI 信号，每周读 AI 判断
          </h1>
          <p className="mt-4 max-w-lg text-body md:text-[0.95rem]">
            多源聚合与 Pulse Score 排序，帮你忽略噪音；周报提炼一周<span className="font-medium text-slate-800">值得投入</span>
            的方向。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/rankings" className="btn-primary-lg no-underline">
              查看今日榜单
            </Link>
            <Link to="/#subscribe" className="btn-secondary no-underline">
              订阅周报
            </Link>
          </div>
        </div>

        <div className="card-surface p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">今日判断</span>
            {rankUpdatedAt ? (
              <time className="text-[0.7rem] tabular-nums text-slate-500" dateTime={rankUpdatedAt}>
                更新 {new Date(rankUpdatedAt).toLocaleString('zh-CN')}
              </time>
            ) : (
              <span className="text-[0.7rem] text-slate-400">—</span>
            )}
          </div>

          {lead ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ScoreBadge score={lead.ranking_score} variant="pill" />
                <ActionBadge suggestion={lead.action_suggestion} />
              </div>
              <p className="mt-4 font-headline text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
                {judgmentLine}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center">
                <div>
                  <dt className="text-[0.65rem] font-medium text-slate-500">新鲜度</dt>
                  <dd className="mt-1 font-headline text-sm font-semibold tabular-nums text-slate-800">
                    {fmtScore(br?.freshness)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-medium text-slate-500">热度</dt>
                  <dd className="mt-1 font-headline text-sm font-semibold tabular-nums text-slate-800">
                    {fmtScore(br?.heat)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.65rem] font-medium text-slate-500">用户价值</dt>
                  <dd className="mt-1 font-headline text-sm font-semibold tabular-nums text-slate-800">
                    {fmtScore(br?.user_value)}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                <Link to={`/events/${lead.id}`} className="text-sm font-semibold text-primary hover:underline">
                  查看事件详情 →
                </Link>
                <Link to="/rankings" className="text-sm font-medium text-slate-600 hover:text-primary hover:underline">
                  完整榜单
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              {!topLoaded ? '正在加载榜单…' : '暂无榜单数据。运行每日任务后将自动展示。'}
            </p>
          )}
        </div>
      </header>

      {/* Top 5 */}
      <section className="section-y">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="heading-section">今日 AI Pulse Top 5</h2>
            <p className="mt-1 text-muted">今日最值得关注的判断与信号（紧凑视图）。</p>
          </div>
          <Link to="/rankings" className="text-sm font-medium text-primary hover:underline">
            查看完整榜单 →
          </Link>
        </div>
        {topErr ? <p className="mb-4 text-sm text-amber-800">{topErr}</p> : null}
        <div className="space-y-2">
          {top5.map((item, idx) => (
            <RankingCard key={item.id} rank={idx + 1} item={item} variant="homeRow" />
          ))}
          {!topErr && top5.length === 0 && topLoaded ? (
            <p className="text-sm text-slate-600">暂无榜单数据。请在服务器运行：`python -m app.jobs.daily_rankings`</p>
          ) : null}
        </div>
      </section>

      {/* How it works */}
      <section className="section-y">
        <h2 className="heading-section mb-5">AI Pulse 如何工作</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-surface p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-primary">
              <LineChart className="h-4 w-4" />
            </div>
            <h3 className="mt-3 font-headline text-sm font-semibold text-slate-900">每日排行榜</h3>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-600">多源抓取、去重与排序。</p>
          </div>
          <div className="card-surface p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <h3 className="mt-3 font-headline text-sm font-semibold text-slate-900">Pulse Score</h3>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-600">可信度、时效、热度与价值加权。</p>
          </div>
          <div className="card-surface p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="mt-3 font-headline text-sm font-semibold text-slate-900">AI 判断</h3>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-600">一句话判断与行动建议。</p>
          </div>
          <div className="card-surface p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <h3 className="mt-3 font-headline text-sm font-semibold text-slate-900">每周报告</h3>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-600">主线、边界与可忽略噪音。</p>
          </div>
        </div>
      </section>

      {/* Weekly preview */}
      <section className="section-y">
        <h2 className="heading-section mb-1">本周判断报告预览</h2>
        <p className="mb-5 text-muted">最新一期周报摘要（若有）。</p>
        {weeklyErr || !weeklyPreview?.headline ? (
          <EmptyState
            title="暂无已发布周报"
            description="订阅后，我们将在每期周报就绪时推送摘要；你也可以稍后在「周报」页查看。"
            actionLabel="订阅周报"
            actionTo="/#subscribe"
          />
        ) : (
          <div className="card-surface p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {weeklyPreview.reportDate ? (
                <time dateTime={weeklyPreview.reportDate}>{weeklyPreview.reportDate}</time>
              ) : null}
              <span className="text-slate-300">·</span>
              <span>约 {weeklyPreview.readingMinutes} 分钟</span>
            </div>
            <h3 className="mt-4 font-headline text-lg font-semibold leading-snug text-slate-900 md:text-xl">
              {weeklyPreview.headline}
            </h3>
            {weeklyPreview.summary ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-600 line-clamp-4">{weeklyPreview.summary}</p>
            ) : weeklyPreview.boundary ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-600 line-clamp-3">{weeklyPreview.boundary}</p>
            ) : weeklyPreview.titles[0] ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{weeklyPreview.titles[0]}</p>
            ) : null}
            <Link to="/weekly/latest" className="btn-primary mt-6 inline-flex no-underline">
              阅读完整报告
            </Link>
          </div>
        )}
      </section>

      {/* Subscribe */}
      <section id="subscribe" className="scroll-mt-28 card-surface section-y p-5 md:p-8">
        <h2 className="heading-section">订阅周报</h2>
        <p className="mt-2 text-muted">
          日报看今日信号；周报看这一周<strong className="font-medium text-slate-800">值得投入什么</strong>。
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
