import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchRankings, fetchWeeklyLatest } from '../api/public';
import { HomeTopFiveTable } from '../components/home/HomeTopFiveTable';
import { InformationQualityWorkflow } from '../components/home/InformationQualityWorkflow';
import { TodayFocusCard } from '../components/home/TodayFocusCard';
import { EmptyState } from '../components/common/EmptyState';
import { estimateReadingMinutes } from '../components/weekly/weeklyPayloadUtils';
import { formatSlashDateFromIso } from '../lib/homeRankingsDisplay';

/** 周报预览右侧：文档式轻立体插画（极简、非占位大块） */
function ReportPreviewIllustration() {
  return (
    <div
      className="flex w-full shrink-0 justify-center md:w-[220px] md:max-w-[220px] md:justify-end lg:w-[240px] lg:max-w-[240px]"
      aria-hidden
    >
      <div className="relative w-[min(200px,72vw)] md:w-[200px]">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-[#E8F1FF]/35 blur-2xl" />
        <div className="relative rounded-[15px] border border-[#D8E2F0] bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.06),0_2px_8px_rgba(37,99,235,0.06)]">
          <div className="pointer-events-none absolute right-0 top-0 h-10 w-10 overflow-hidden rounded-tr-[14px]">
            <div className="absolute right-0 top-0 h-14 w-14 translate-x-1/3 -translate-y-1/3 rotate-45 bg-[#EDF4FF]" />
          </div>
          <div className="relative space-y-2 pt-0.5">
            <div className="h-2 w-[72%] rounded-full bg-slate-100" />
            <div className="h-2 w-full rounded-full bg-slate-50" />
            <div className="h-2 w-[88%] rounded-full bg-slate-50/90" />
          </div>
          <svg viewBox="0 0 132 52" className="mt-3.5 h-[52px] w-full" fill="none" aria-hidden>
            <rect x="4" y="8" width="124" height="36" rx="6" fill="#F8FAFC" stroke="#E5ECF5" strokeWidth="1" />
            <path
              d="M16 38 L40 30 L60 34 L84 18 L108 24 L118 20"
              stroke="#2563EB"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="84" cy="18" r="3" fill="#2563EB" opacity="0.35" />
          </svg>
          <div className="mt-2 flex gap-1.5">
            <span className="h-1.5 flex-1 rounded-full bg-[#DBEAFE]" />
            <span className="h-1.5 w-8 rounded-full bg-[#EFF6FF]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
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
        const top3 = (normal.top3 as Array<{ title?: string; event_id?: unknown }> | undefined) || [];
        const caps =
          (normal.capability_boundaries as Array<{ question?: string; conclusion?: string }> | undefined) || [];
        const hl = thesis?.headline?.trim();
        const summary = (thesis?.summary ?? '').trim();
        const titles = top3
          .filter((x) => String(x?.event_id ?? '').trim())
          .map((x) => String(x.title || ''))
          .filter(Boolean)
          .slice(0, 3);
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

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-5 md:px-6 md:pb-20 md:pt-7">
      {/* Hero：底部留白略收紧，避免与 Top5 之间视觉断层过大 */}
      <section className="mb-8 pb-5 md:mb-10 md:pb-7">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_470px] lg:items-start lg:gap-16">
          <div className="min-w-0">
            <h1 className="max-w-[460px] font-headline text-[38px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#0F172A] md:text-[48px] md:leading-[1.08] xl:text-[52px]">
              每天看 AI 信号，
              <br className="hidden sm:block" />
              每周读 AI 简报
            </h1>
            <p className="mt-[22px] max-w-[420px] text-[16px] font-normal leading-[1.8] text-[#64748B]">
              追踪全球 AI 动态，筛出值得看的信息，帮你做出判断。
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              <Link
                to="/rankings"
                className="inline-flex h-[46px] items-center justify-center rounded-full bg-[#1463FF] px-5 text-[15px] font-bold text-white no-underline transition-opacity hover:opacity-95"
              >
                查看今日榜单
              </Link>
              <Link
                to="/subscribe"
                className="inline-flex h-[46px] items-center justify-center rounded-full border border-[#BFD3FF] bg-white px-5 text-[15px] font-bold text-[#1463FF] no-underline transition-colors hover:bg-[#F8FAFF]"
              >
                订阅周报
              </Link>
            </div>
          </div>
          <TodayFocusCard item={top5[0] ?? null} rankUpdatedAt={rankUpdatedAt} loaded={topLoaded} />
        </div>
      </section>

      {/* Top 5 table */}
      <section className="mb-14 md:mb-16">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-[30px] font-extrabold leading-[1.2] text-[#0F172A]">今日 AI Pulse Top 5</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-[1.7] text-[#64748B]">
              基于多源信息与 Pulse Score，筛出今日最值得关注的 5 条 AI 动态。
            </p>
          </div>
          <Link to="/rankings" className="shrink-0 text-[15px] font-bold text-[#2563EB] hover:underline">
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

      {/* Weekly preview：画布色见 body/layout；内层白卡 border-card-border */}
      <section className="mb-[80px]">
        <h2 className="font-headline text-[30px] font-extrabold leading-[1.2] text-[#0F172A]">本周 AI 信号简报预览</h2>
        <p className="mb-5 mt-2 text-[14px] leading-relaxed text-[#94A3B8]">最新一期周报的结构化整理。</p>
        {weeklyErr || !weeklyPreview?.headline ? (
          <EmptyState
            title="暂无已发布周报"
            description="订阅后，我们将在每期周报就绪时推送摘要；你也可以稍后在「周报」页查看。"
            actionLabel="订阅周报"
            actionTo="/subscribe"
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-[#D8E2F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex flex-col gap-6 px-7 py-7 md:grid md:grid-cols-[minmax(0,1fr)_220px] md:items-start md:gap-9 md:px-8 md:py-7 lg:grid-cols-[minmax(0,1fr)_240px] lg:px-9 lg:py-8">
              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="inline-flex w-fit shrink-0 rounded-full border border-[#C9DCF5] bg-white px-2.5 py-1 text-[12px] font-bold leading-none text-[#2563EB]">
                    本周信号简报预览
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 text-[13px] leading-none text-[#94A3B8] sm:justify-end">
                    {weeklyPreview.reportDate ? (
                      <time dateTime={weeklyPreview.reportDate}>{formatSlashDateFromIso(weeklyPreview.reportDate)}</time>
                    ) : null}
                    {weeklyPreview.reportDate ? <span className="text-[#CBD5E1]">·</span> : null}
                    <span>阅读约 {weeklyPreview.readingMinutes} 分钟</span>
                  </div>
                </div>
                <h3 className="mt-4 line-clamp-2 max-w-[640px] font-headline text-[24px] font-extrabold leading-[1.3] tracking-[-0.015em] text-[#0F172A] [overflow-wrap:anywhere] md:text-[26px] md:leading-[1.28] xl:text-[28px] xl:leading-[1.32]">
                  {weeklyPreview.headline}
                </h3>
                {weeklyPreview.summary ? (
                  <div className="mt-3 max-w-[580px] text-[15px] font-normal leading-[1.8] text-[#64748B]">
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
                  <p className="mt-3 max-w-[580px] text-[15px] leading-[1.8] text-[#64748B] line-clamp-3">{weeklyPreview.boundary}</p>
                ) : weeklyPreview.titles[0] ? (
                  <p className="mt-3 max-w-[580px] text-[15px] leading-[1.8] text-[#64748B] line-clamp-3">{weeklyPreview.titles[0]}</p>
                ) : null}
                <Link
                  to="/weekly/latest"
                  className="mt-5 inline-flex h-[42px] items-center justify-center rounded-full bg-[#1463FF] px-[20px] text-[15px] font-bold text-white no-underline transition-opacity hover:opacity-95 md:h-11 md:px-[22px]"
                >
                  阅读完整报告 →
                </Link>
              </div>
              <ReportPreviewIllustration />
            </div>
          </div>
        )}
      </section>

      {/* 信息质量说明 — 紧随周报，间距约 80px（见上周报 section mb） */}
      <InformationQualityWorkflow />
    </div>
  );
}
