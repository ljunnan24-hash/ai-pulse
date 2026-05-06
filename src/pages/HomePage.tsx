import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  ChevronRight,
  Flame,
  LineChart,
  Sparkles,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { apiBase } from '../config';
import type { EventDetailResponse } from '../api/public';
import { fetchEventDetail, fetchRankings, fetchWeeklyLatest } from '../api/public';
import { ScoreBadge } from '../components/common/ScoreBadge';
import { buildDisplayJudgment } from '../components/rankings/RankingCard';
import { RankingTable } from '../components/rankings/RankingTable';
import { EmptyState } from '../components/common/EmptyState';
import { estimateReadingMinutes } from '../components/weekly/weeklyPayloadUtils';
import { formatSlashDate } from '../lib/formatDisplayDate';
import { displayInsightSummary } from '../lib/insightFallback';

/** 由分项分数推导「编辑视角」标签，避免仪表盘式大数字 */
function judgmentChips(
  br: EventDetailResponse['score_breakdown'] | undefined,
  category: string,
): string[] {
  const out: string[] = [];
  if (br) {
    if ((br.trust ?? 0) >= 72) out.push('可信来源');
    if ((br.freshness ?? 0) >= 68) out.push('新鲜度高');
    if ((br.user_value ?? 0) >= 62) out.push('用户相关');
    if ((br.heat ?? 0) >= 58) out.push('关注度高');
  }
  const catMap: Record<string, string> = {
    model: '模型能力',
    tool: '企业落地',
    industry: '行业动态',
    open_source: '开源生态',
    application: '应用落地',
  };
  const fill = catMap[category] ?? '综合信号';
  if (out.length === 0) out.push(fill);
  else if (out.length < 3 && !out.includes(fill)) out.push(fill);
  return out.slice(0, 3);
}

function tierLabel(v: number): string {
  if (v >= 70) return '极高';
  if (v >= 55) return '高';
  if (v >= 40) return '中';
  return '观察';
}

function HeroMetric({
  label,
  value,
  icon: Icon,
  iconClassName = 'text-primary',
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClassName?: string;
}) {
  const n = Number.isFinite(value) ? value : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-slate-100 bg-white px-2 py-2.5 text-center shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:px-3">
      <Icon className={`h-4 w-4 ${iconClassName}`} aria-hidden />
      <span className="mt-1.5 text-[0.65rem] font-semibold text-slate-600">{label}</span>
      <span className="mt-0.5 font-headline text-lg font-bold tabular-nums text-[#111827]">{n.toFixed(0)}</span>
      <span className="text-[0.65rem] font-medium text-slate-500">{tierLabel(n)}</span>
    </div>
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
  const [top3, setTop3] = useState<Awaited<ReturnType<typeof fetchRankings>>['items']>([]);
  const [rankUpdatedAt, setRankUpdatedAt] = useState<string | null>(null);
  const [topErr, setTopErr] = useState<string | null>(null);
  const [topLoaded, setTopLoaded] = useState(false);
  const [leadDetail, setLeadDetail] = useState<EventDetailResponse | null>(null);
  const [leadDetailLoading, setLeadDetailLoading] = useState(false);
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
    const id = top3[0]?.id;
    if (!id) {
      setLeadDetail(null);
      setLeadDetailLoading(false);
      return;
    }
    setLeadDetailLoading(true);
    fetchEventDetail(id)
      .then(setLeadDetail)
      .catch(() => setLeadDetail(null))
      .finally(() => setLeadDetailLoading(false));
  }, [top3]);

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
  const br = leadDetail?.score_breakdown;
  const leadJudgment = lead ? buildDisplayJudgment(lead) : null;
  const judgmentLine =
    leadJudgment?.text ??
    (!lead && topLoaded ? '暂无榜单数据。运行每日任务后将自动展示。' : !lead ? '正在加载…' : '');
  const chips = lead ? judgmentChips(br, lead.category) : [];
  const heroSummary = lead ? displayInsightSummary(lead.what_it_means_for_you, lead.what_happened) : '';
  const heroDateIso = lead?.published_at ?? rankUpdatedAt ?? '';

  return (
    <div className="page-container">
      {/* Hero：移动端顺序为 标题 → 今日判断卡 → 副文案 → CTA；桌面端左文案右卡片 */}
      <header className="section-y grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-14 lg:items-start">
        <h1 className="font-headline text-[1.85rem] font-extrabold leading-[1.12] tracking-tight text-[#111827] md:text-[2.35rem] lg:col-start-1 lg:row-start-1">
          每天看 AI 信号，
          <br className="hidden sm:block" />
          每周读 AI 判断
        </h1>

        <div className="card-surface p-5 md:p-6 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">今日判断</span>
            <time className="text-[0.8rem] tabular-nums text-slate-500" dateTime={heroDateIso || undefined}>
              {heroDateIso ? formatSlashDate(heroDateIso) : '—'}
            </time>
          </div>

          {lead ? (
            <>
              <div className="mt-4">
                <ScoreBadge score={lead.ranking_score} variant="pillHero" />
              </div>
              <p
                className={`mt-4 font-headline leading-snug text-[#111827] [overflow-wrap:anywhere] ${
                  leadJudgment?.isTitleFallback
                    ? 'line-clamp-4 text-[0.95rem] font-medium md:line-clamp-5 md:text-[1rem]'
                    : 'line-clamp-5 text-[1.05rem] font-semibold md:line-clamp-6 md:text-[1.1rem]'
                }`}
              >
                {judgmentLine}
              </p>
              {heroSummary ? (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#666666]">{heroSummary}</p>
              ) : null}
              {leadDetailLoading ? (
                <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden>
                  {[1, 2, 3].map((k) => (
                    <div key={k} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : br ? (
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5">
                  <HeroMetric label="新鲜度" value={Number(br.freshness) || 0} icon={Zap} />
                  <HeroMetric label="热度" value={Number(br.heat) || 0} icon={Flame} iconClassName="text-orange-500" />
                  <HeroMetric label="用户价值" value={Number(br.user_value) || 0} icon={UserRound} />
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <Link to={`/events/${lead.id}`} className="text-sm font-semibold text-primary hover:underline">
                  查看事件详情 →
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              {!topLoaded ? '正在加载榜单…' : '暂无榜单数据。运行每日任务后将自动展示。'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-2">
          <div className="max-w-xl space-y-3 text-[0.9375rem] leading-relaxed text-[#666666]">
            <p>
              汇聚全球 AI 产品与模型的关键进展，通过结构化排序与可解释的 Pulse Score，优先呈现
              <strong className="font-semibold text-[#111827]">当下最值得跟进</strong>的信号。
            </p>
            <p>
              更快分辨<strong className="font-semibold text-[#111827]">什么值得投入</strong>，
              <strong className="font-semibold text-[#111827]">什么可以忽略</strong>。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/rankings" className="btn-primary-lg no-underline">
              查看今日榜单
            </Link>
            <Link
              to="/#subscribe"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-btn)] border border-primary bg-white px-6 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5 no-underline"
            >
              订阅周报
            </Link>
          </div>
        </div>
      </header>

      {/* Top 3 */}
      <section className="section-y">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="heading-section">今日 AI Pulse Top 3</h2>
            <p className="mt-1 text-[0.8125rem] text-[#666666]">统一榜单容器：桌面为表格式扫读；移动端为紧凑纵向行。</p>
          </div>
          <Link to="/rankings" className="text-sm font-medium text-primary hover:underline">
            查看完整榜单 →
          </Link>
        </div>
        {topErr ? <p className="mb-4 text-sm text-amber-800">{topErr}</p> : null}
        {!topErr && top3.length > 0 ? (
          <RankingTable
            variant="home"
            items={top3}
            footer={
              <div className="py-3 text-center">
                <Link to="/rankings" className="text-sm font-semibold text-primary hover:underline">
                  查看完整 Top 20 榜单 →
                </Link>
              </div>
            }
          />
        ) : null}
        {!topErr && topLoaded && top3.length === 0 ? (
          <p className="text-sm text-slate-600">暂无榜单数据。请在服务器运行：`python -m app.jobs.daily_rankings`</p>
        ) : null}
      </section>

      {/* How it works */}
      <section className="section-y">
        <h2 className="heading-section mb-2">AI Pulse 如何工作</h2>
        <p className="mb-6 max-w-2xl text-muted">从信号收录到周报沉淀，形成闭环。</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {[
            { n: '01', icon: LineChart, t: '每日排行榜', d: '多源抓取、去重与排序。' },
            { n: '02', icon: Activity, t: 'AI Pulse Score', d: '可信度、时效、热度与价值加权。' },
            { n: '03', icon: Sparkles, t: 'AI 判断', d: '一句话判断与行动建议。' },
            { n: '04', icon: BookOpen, t: '每周报告', d: '主线、边界与可忽略噪音。' },
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
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[#D6E8FF] bg-[#F0F7FF] shadow-[var(--shadow-card)]">
            <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_min(40%,220px)] md:items-center md:gap-8 md:p-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#666666]">
                  <span className="rounded-md border border-primary/35 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                    本周判断报告预览
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
