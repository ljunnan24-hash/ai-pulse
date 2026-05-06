import { Link } from 'react-router-dom';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

import { ActionBadge } from '../common/ActionBadge';
import { SectionHeader } from '../common/SectionHeader';
import { CapabilityBoundaryCard } from './CapabilityBoundaryCard';
import { CategoryRecapCard } from './CategoryRecapCard';
import { GlossaryGrid } from './GlossaryGrid';
import { NoiseCard } from './NoiseCard';
import { TopJudgmentCard } from './TopJudgmentCard';
import { ToolTryCard } from './ToolTryCard';
import type { ThesisShape } from './WeeklyThesisCard';
import { ReportCoverCard } from './ReportCoverCard';
import { ReportCoverFallback } from './ReportCoverFallback';
import { WeeklyReportHeader } from './WeeklyReportHeader';
import type { TocItem } from './WeeklyToc';
import { WeeklyToc } from './WeeklyToc';
import { estimateReadingMinutes, normalizeGlossary } from './weeklyPayloadUtils';

export type WeeklyReportViewProps = {
  title: string;
  reportDate: string;
  payload: Record<string, unknown>;
};

function hasThesisContent(t: ThesisShape | undefined): boolean {
  if (!t || typeof t !== 'object') return false;
  const h = (t.headline ?? '').trim();
  const s = (t.summary ?? '').trim();
  const lines = Array.isArray(t.trend_lines) ? t.trend_lines.filter(Boolean) : [];
  return Boolean(h || s || lines.length > 0);
}

export function WeeklyReportView({ title, reportDate, payload }: WeeklyReportViewProps) {
  const normal = (payload.normal as Record<string, unknown> | undefined) || {};
  const thesis = normal.weekly_thesis as ThesisShape | undefined;
  const showThesis = hasThesisContent(thesis);

  const top3Judgments = (normal.top3_judgments as Array<Record<string, string>> | undefined) || [];
  const legacyTop3 = (normal.top3 as Array<Record<string, string>> | undefined) || [];
  const showJudgments = top3Judgments.length > 0;
  const showLegacyTop3 = !showJudgments && legacyTop3.length > 0;

  const capsBoundaries =
    (normal.capability_boundaries as Array<Record<string, unknown>> | undefined) || [];
  const caps = (normal.capabilities as Array<Record<string, string>> | undefined) || [];
  const showCapsV2 = capsBoundaries.length > 0;
  const showCapsLegacy = !showCapsV2 && caps.length > 0;

  const toolsTry = (normal.tools_to_try as Array<Record<string, string>> | undefined) || [];
  const tools = (normal.tools as Array<Record<string, string>> | undefined) || [];
  const showToolsV2 = toolsTry.length > 0;
  const showToolsLegacy = !showToolsV2 && tools.length > 0;

  const noiseIgnore = (normal.noise_to_ignore as Array<Record<string, string>> | undefined) || [];

  const categoryRecap =
    (normal.category_recap as Array<Record<string, unknown>> | undefined) || [];
  const sections = (normal.sections as Array<{ title: string; items: unknown[] }> | undefined) || [];
  const showRecapV2 = categoryRecap.length > 0;
  const showRecapLegacy = !showRecapV2 && sections.length > 0;

  const glossaryRows = normalizeGlossary(payload, normal);

  const radar = normal.capability_radar as
    | {
        title?: string;
        dimensions?: Array<{ key: string; label: string; score: number; baseline?: number }>;
      }
    | undefined;

  const radarData =
    radar?.dimensions?.map((d) => ({
      dim: d.label || d.key,
      score: Number(d.score) || 0,
      baseline: Number(d.baseline) || 0,
    })) || [];

  const readingMinutes = estimateReadingMinutes(payload);
  const top3Count = showJudgments ? top3Judgments.length : legacyTop3.length;
  const noiseCount = noiseIgnore.length;

  const tocItems: TocItem[] = [];
  tocItems.push({ id: 'weekly-thesis', label: '本周判断' });
  if (showJudgments || showLegacyTop3) tocItems.push({ id: 'top3-judgments', label: 'Top 3 判断' });
  if (showCapsV2 || showCapsLegacy) tocItems.push({ id: 'capability-boundaries', label: '能力边界' });
  if (radarData.length > 0) tocItems.push({ id: 'capability-radar', label: '能力雷达' });
  if (showToolsV2 || showToolsLegacy) tocItems.push({ id: 'tools-to-try', label: '工具' });
  if (noiseIgnore.length > 0) tocItems.push({ id: 'noise-ignore', label: '噪音' });
  if (showRecapV2 || showRecapLegacy) tocItems.push({ id: 'category-recap', label: '分类回顾' });
  if (glossaryRows.length > 0) tocItems.push({ id: 'glossary', label: '术语' });

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-24 pt-6 md:px-6 md:pt-8">
      <WeeklyReportHeader reportDate={reportDate} title={title} />

      {showThesis && thesis ? (
        <ReportCoverCard
          thesis={thesis}
          readingMinutes={readingMinutes}
          topJudgmentCount={top3Count}
          noiseFilteredCount={noiseCount}
        />
      ) : (
        <ReportCoverFallback readingMinutes={readingMinutes} topJudgmentCount={top3Count} noiseFilteredCount={noiseCount} />
      )}

      {tocItems.length > 0 ? (
        <div className="mb-8 flex flex-wrap gap-2 lg:hidden">
          {tocItems.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
            >
              {it.label}
            </a>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
        <div className="min-w-0 flex-1 lg:max-w-[760px]">
          <section id="top3-judgments" className="scroll-mt-28">
            <SectionHeader
              title={showJudgments || showLegacyTop3 ? '本周最重要的 3 个判断' : '本周重点'}
              subtitle={
                showJudgments || showLegacyTop3
                  ? '不是最热的三条新闻，而是本周最值得采取行动的判断。'
                  : undefined
              }
            />

            <div className="space-y-8">
              {showJudgments
                ? top3Judgments.map((t, i) => <TopJudgmentCard key={`${t.title}-${i}`} rank={i + 1} row={t} />)
                : null}

              {showLegacyTop3
                ? legacyTop3.map((t, i) => (
                    <article
                      key={`${t.url}-${i}`}
                      className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_14px_rgba(15,23,42,0.06)] md:p-7"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                        <span className="font-headline text-3xl font-black tabular-nums leading-none text-[#005bc1]">
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                        <ActionBadge suggestion="先观望" />
                      </div>
                      <h3 className="mt-5 font-headline text-xl font-bold text-slate-900">{t.title}</h3>
                      <div className="mt-6 space-y-5 text-sm">
                        {t.what_happened ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">发生了什么</p>
                            <p className="mt-2 leading-relaxed text-slate-700">{t.what_happened}</p>
                          </div>
                        ) : null}
                        {t.what_it_means_for_you ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">对你意味着什么</p>
                            <p className="mt-2 leading-relaxed text-slate-800">{t.what_it_means_for_you}</p>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))
                : null}

              {!showJudgments && !showLegacyTop3 ? (
                <p className="text-sm text-slate-600">本期暂无 Top3 数据。</p>
              ) : null}
            </div>
          </section>

          <section id="capability-boundaries" className="mt-14 scroll-mt-28">
            <SectionHeader
              title="AI 能力边界"
              subtitle="这些事件说明：AI 现在能做到什么，还不能做到什么。"
            />
            <div className="space-y-8">
              {showCapsV2
                ? capsBoundaries.map((c, i) => <CapabilityBoundaryCard key={i} row={c} />)
                : null}
              {showCapsLegacy
                ? caps.map((c, i) => (
                    <article
                      key={i}
                      className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-7"
                    >
                      <h3 className="font-headline text-lg font-bold text-slate-900">{c.theme}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-slate-700">{c.conclusion}</p>
                    </article>
                  ))
                : null}
              {!showCapsV2 && !showCapsLegacy ? (
                <p className="text-sm text-slate-600">本期暂无能力边界卡片。</p>
              ) : null}
            </div>
          </section>

          {radarData.length > 0 ? (
            <section id="capability-radar" className="mt-14 scroll-mt-28">
              <SectionHeader title={radar?.title || 'AI 能力雷达'} />
              <div className="h-72 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dim" />
                    <Radar name="本期" dataKey="score" stroke="#005bc1" fill="#005bc1" fillOpacity={0.35} />
                    <Radar name="基线" dataKey="baseline" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.12} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          <section id="tools-to-try" className="mt-14 scroll-mt-28">
            <SectionHeader
              title={showToolsV2 || showToolsLegacy ? '本周值得试的工具' : '工具参考'}
              subtitle={
                showToolsV2 || showToolsLegacy
                  ? '这些不是单纯新闻，而是本周可以实际动手试的 AI 工具。'
                  : undefined
              }
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {showToolsV2
                ? toolsTry.map((t, i) => <ToolTryCard key={i} row={t} />)
                : null}
              {showToolsLegacy
                ? tools.map((t, i) => (
                    <ToolTryCard
                      key={i}
                      row={{
                        name: t.name,
                        what_it_does: t.what_it_means_for_you || '',
                      }}
                    />
                  ))
                : null}
            </div>
            {!showToolsV2 && !showToolsLegacy ? (
              <p className="text-sm text-slate-600">本期暂无工具推荐。</p>
            ) : null}
          </section>

          {noiseIgnore.length > 0 ? (
            <section id="noise-ignore" className="mt-14 scroll-mt-28">
              <SectionHeader
                title="本周可以忽略的噪音"
                subtitle="不是所有高热事件都值得你投入时间。以下内容暂时可以跳过。"
              />
              <div className="space-y-5">
                {noiseIgnore.map((n, i) => (
                  <NoiseCard key={i} row={n} />
                ))}
              </div>
            </section>
          ) : null}

          <section id="category-recap" className="mt-14 scroll-mt-28">
            <SectionHeader
              title="分类回顾"
              subtitle="按领域整理本周变化，帮助你理解不同方向的趋势。"
            />
            <div className="space-y-8">
              {showRecapV2
                ? categoryRecap.map((row, i) => <CategoryRecapCard key={i} row={row} />)
                : null}
              {showRecapLegacy
                ? sections.map((sec, i) => (
                    <article key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="font-headline text-lg font-bold text-slate-900">{sec.title}</h3>
                      <ul className="mt-4 space-y-2">
                        {(sec.items as Array<Record<string, string>>).map((it, j) => (
                          <li key={j} className="text-sm text-slate-600">
                            {it.title}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))
                : null}
              {!showRecapV2 && !showRecapLegacy ? (
                <p className="text-sm text-slate-600">本期暂无分类回顾。</p>
              ) : null}
            </div>
          </section>

          {glossaryRows.length > 0 ? (
            <section id="glossary" className="mt-14 scroll-mt-28">
              <SectionHeader
                title="本周术语"
                subtitle="理解这些概念，可以更快读懂本周 AI 动态。"
              />
              <GlossaryGrid rows={glossaryRows} />
            </section>
          ) : null}

          <section
            id="weekly-bottom-cta"
            className="mt-14 scroll-mt-28 rounded-2xl border border-[#005bc1]/20 bg-gradient-to-br from-[#e8f2fc] to-white px-6 py-8 text-center shadow-sm md:px-10 md:text-left"
          >
            <h2 className="font-headline text-xl font-bold text-slate-900 md:text-2xl">每周收到这样的 AI 判断报告</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 md:mx-0">
              不用每天刷几十个信息源，AI Pulse 每周帮你整理：
              <span className="text-slate-800">什么值得试，什么先观望，什么可以忽略。</span>
            </p>
            <Link
              to="/#subscribe"
              className="mt-6 inline-flex w-full justify-center rounded-full bg-[#005bc1] px-8 py-3 font-headline text-sm font-bold text-white shadow-md hover:bg-[#004a9e] sm:w-auto"
            >
              订阅周报
            </Link>
          </section>

          <Link to="/archive" className="mt-12 inline-block text-sm font-medium text-[#005bc1] hover:underline">
            ← 历史归档
          </Link>
        </div>

        <aside className="hidden w-[280px] shrink-0 lg:block">
          <div className="sticky top-24 space-y-6">
            <WeeklyToc items={tocItems} />
          </div>
        </aside>
      </div>
    </div>
  );
}
