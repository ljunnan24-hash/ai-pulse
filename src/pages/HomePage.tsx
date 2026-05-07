import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchRankings, fetchWeeklyLatest } from '../api/public';
import { HomeTopFiveTable } from '../components/home/HomeTopFiveTable';
import { InformationQualityWorkflow } from '../components/home/InformationQualityWorkflow';
import { TodayFocusCard } from '../components/home/TodayFocusCard';
import { EmptyState } from '../components/common/EmptyState';
import { estimateReadingMinutes } from '../components/weekly/weeklyPayloadUtils';
import { formatSlashDateFromIso } from '../lib/homeRankingsDisplay';

function ReportPreviewIllustration() {
  return (
    <div
      className="hidden shrink-0 md:flex h-[190px] w-[190px] items-center justify-center rounded-[28px] border border-[#C7DCFF] bg-[#DCEBFF]"
      aria-hidden
    >
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[20px] bg-[#C9DCFF]">
        <svg viewBox="0 0 120 120" className="h-12 w-12 text-[#3B82F6]" fill="none">
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

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-5 md:px-6 md:pb-20 md:pt-7">
      {/* Hero */}
      <section className="mb-16 pb-10 md:mb-20 md:pb-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_470px] lg:items-start lg:gap-16">
          <div className="min-w-0">
            <h1 className="max-w-[520px] font-headline text-[40px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#0F172A] md:text-[64px] md:leading-[1.1]">
              每天看 AI 信号，
              <br className="hidden sm:block" />
              每周读 AI 简报
            </h1>
            <p className="mt-4 max-w-[540px] text-[16px] font-normal leading-[1.8] text-[#64748B] md:mt-5">
              AI Pulse 持续追踪全球 AI 产品、模型、工具与行业动态，基于多源数据筛选重要信息，用 Pulse Score 作为排序参考，并在每周 AI 信号简报中整理关键变化、工具线索与背景解释。
            </p>
            <div className="mt-6 flex flex-wrap gap-4 md:mt-7">
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
      <section className="mb-[72px]">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

      <InformationQualityWorkflow />

      {/* Weekly preview */}
      <section>
        <h2 className="font-headline text-[30px] font-extrabold leading-[1.2] text-[#0F172A]">本周信息摘要预览</h2>
        <p className="mb-6 mt-2 text-[15px] leading-[1.7] text-[#64748B]">最新一期周报的结构化整理。</p>
        {weeklyErr || !weeklyPreview?.headline ? (
          <EmptyState
            title="暂无已发布周报"
            description="订阅后，我们将在每期周报就绪时推送摘要；你也可以稍后在「周报」页查看。"
            actionLabel="订阅周报"
            actionTo="/subscribe"
          />
        ) : (
          <div className="min-h-[270px] overflow-hidden rounded-[24px] border border-[#D8E8FF] bg-[#EEF5FF]">
            <div className="grid gap-10 px-8 py-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-center md:gap-10 md:px-9">
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
                <h3 className="mt-5 line-clamp-3 max-w-[760px] font-headline text-[30px] font-extrabold leading-[1.28] tracking-[-0.02em] text-[#0F172A] [overflow-wrap:anywhere]">
                  {weeklyPreview.headline}
                </h3>
                {weeklyPreview.summary ? (
                  <div className="mt-4 max-w-[760px] text-[15px] font-normal leading-[1.85] text-[#64748B]">
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
                  <p className="mt-4 max-w-[760px] text-[15px] leading-[1.85] text-[#64748B] line-clamp-3">{weeklyPreview.boundary}</p>
                ) : weeklyPreview.titles[0] ? (
                  <p className="mt-4 max-w-[760px] text-[15px] leading-[1.85] text-[#64748B]">{weeklyPreview.titles[0]}</p>
                ) : null}
                <Link
                  to="/weekly/latest"
                  className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-[#1463FF] px-5 text-[15px] font-bold text-white no-underline transition-opacity hover:opacity-95"
                >
                  阅读完整报告 →
                </Link>
              </div>
              <ReportPreviewIllustration />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
