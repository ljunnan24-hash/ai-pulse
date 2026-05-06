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

const TOC_META: Record<string, { hint: string; minutes: string }> = {
  'weekly-thesis': { hint: '核心结论与主线', minutes: '~5 分钟' },
  'top3-judgments': { hint: '本周优先行动', minutes: '~8 分钟' },
  'capability-boundaries': { hint: '能力上限与边界', minutes: '~6 分钟' },
  'capability-radar': { hint: '维度对照', minutes: '~3 分钟' },
  'tools-to-try': { hint: '可动手试用', minutes: '~5 分钟' },
  'noise-ignore': { hint: '可暂不关注', minutes: '~3 分钟' },
  'category-recap': { hint: '分领域要点', minutes: '~7 分钟' },
  glossary: { hint: '术语速查', minutes: '~4 分钟' },
};

function tocEntry(id: string, label: string): TocItem {
  const m = TOC_META[id];
  return { id, label, hint: m?.hint, minutes: m?.minutes };
}

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
  tocItems.push(tocEntry('weekly-thesis', '本周判断'));
  if (showJudgments || showLegacyTop3) tocItems.push(tocEntry('top3-judgments', 'Top 3 判断'));
  if (showCapsV2 || showCapsLegacy) tocItems.push(tocEntry('capability-boundaries', '能力边界'));
  if (radarData.length > 0) tocItems.push(tocEntry('capability-radar', '能力雷达'));
  if (showToolsV2 || showToolsLegacy) tocItems.push(tocEntry('tools-to-try', '工具'));
  if (noiseIgnore.length > 0) tocItems.push(tocEntry('noise-ignore', '噪音'));
  if (showRecapV2 || showRecapLegacy) tocItems.push(tocEntry('category-recap', '分类回顾'));
  if (glossaryRows.length > 0) tocItems.push(tocEntry('glossary', '术语'));

  const sectionHeaderProps = { className: 'mb-5 md:mb-6' };

  return (
    <div className="page-container pb-20 pt-6 md:pt-8">
      <WeeklyReportHeader reportDate={reportDate} title={title} readingMinutes={readingMinutes} />

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
        <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
          {tocItems.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[0.7rem] font-medium text-slate-600 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
            >
              {it.label}
            </a>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-x-10">
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-800 lg:max-w-[42rem] lg:text-[0.95rem] lg:leading-[1.75]">
          <section id="top3-judgments" className="scroll-mt-28">
            <SectionHeader
              {...sectionHeaderProps}
              title={showJudgments || showLegacyTop3 ? '本周最重要的 3 个判断' : '本周重点'}
              subtitle={
                showJudgments || showLegacyTop3
                  ? '不是最热的三条新闻，而是本周最值得采取行动的判断。'
                  : undefined
              }
            />

            <div className="space-y-4 md:space-y-5">
              {showJudgments
                ? top3Judgments.map((t, i) => <TopJudgmentCard key={`${t.title}-${i}`} rank={i + 1} row={t} />)
                : null}

              {showLegacyTop3
                ? legacyTop3.map((t, i) => (
                    <article key={`legacy-${String(t.url ?? i)}-${i}`} className="card-surface p-4 md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <span className="font-headline text-[0.7rem] font-semibold tabular-nums text-primary/90">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <ActionBadge suggestion="先观望" />
                      </div>
                      <h3 className="mt-3 line-clamp-4 font-headline text-lg font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
                        {String(t.title ?? '').trim() || '本周条目'}
                      </h3>
                      <div className="mt-3 space-y-3 text-sm leading-relaxed">
                        {t.what_happened ? (
                          <div>
                            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">发生了什么</p>
                            <p className="mt-1.5 text-slate-700">{t.what_happened}</p>
                          </div>
                        ) : null}
                        {t.what_it_means_for_you ? (
                          <div>
                            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">对你意味着什么</p>
                            <p className="mt-1.5 text-slate-800">{t.what_it_means_for_you}</p>
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

          <section id="capability-boundaries" className="mt-10 scroll-mt-28 md:mt-12">
            <SectionHeader
              {...sectionHeaderProps}
              title="AI 能力边界"
              subtitle="这些事件说明：AI 现在能做到什么，还不能做到什么。"
            />
            <div className="space-y-4 md:space-y-5">
              {showCapsV2
                ? capsBoundaries.map((c, i) => <CapabilityBoundaryCard key={i} row={c} />)
                : null}
              {showCapsLegacy
                ? caps.map((c, i) => (
                    <article key={i} className="card-surface p-5 md:p-6">
                      <h3 className="font-headline text-base font-semibold text-slate-900">{c.theme}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{c.conclusion}</p>
                    </article>
                  ))
                : null}
              {!showCapsV2 && !showCapsLegacy ? (
                <p className="text-sm text-slate-600">本期暂无能力边界卡片。</p>
              ) : null}
            </div>
          </section>

          {radarData.length > 0 ? (
            <section id="capability-radar" className="mt-10 scroll-mt-28 md:mt-12">
              <SectionHeader {...sectionHeaderProps} title={radar?.title || 'AI 能力雷达'} />
              <div className="card-surface h-72 w-full p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="dim" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Radar name="本期" dataKey="score" stroke="#005bc1" fill="#005bc1" fillOpacity={0.28} />
                    <Radar name="基线" dataKey="baseline" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          <section id="tools-to-try" className="mt-10 scroll-mt-28 md:mt-12">
            <SectionHeader
              {...sectionHeaderProps}
              title={showToolsV2 || showToolsLegacy ? '本周值得试的工具' : '工具参考'}
              subtitle={
                showToolsV2 || showToolsLegacy
                  ? '这些不是单纯新闻，而是本周可以实际动手试的 AI 工具。'
                  : undefined
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
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
            <section id="noise-ignore" className="mt-10 scroll-mt-28 md:mt-12">
              <SectionHeader
                {...sectionHeaderProps}
                title="本周可以忽略的噪音"
                subtitle="不是所有高热事件都值得你投入时间。以下内容暂时可以跳过。"
              />
              <div className="space-y-4">
                {noiseIgnore.map((n, i) => (
                  <NoiseCard key={i} row={n} />
                ))}
              </div>
            </section>
          ) : null}

          <section id="category-recap" className="mt-10 scroll-mt-28 md:mt-12">
            <SectionHeader
              {...sectionHeaderProps}
              title="分类回顾"
              subtitle="按领域整理本周变化，帮助你理解不同方向的趋势。"
            />
            <div className="space-y-4 md:space-y-5">
              {showRecapV2
                ? categoryRecap.map((row, i) => <CategoryRecapCard key={i} row={row} />)
                : null}
              {showRecapLegacy
                ? sections.map((sec, i) => (
                    <article key={i} className="card-surface p-5 md:p-6">
                      <h3 className="font-headline text-base font-semibold text-slate-900">{sec.title}</h3>
                      <ul className="mt-3 space-y-2">
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
            <section id="glossary" className="mt-10 scroll-mt-28 md:mt-12">
              <SectionHeader
                {...sectionHeaderProps}
                title="本周术语"
                subtitle="理解这些概念，可以更快读懂本周 AI 动态。"
              />
              <GlossaryGrid rows={glossaryRows} />
            </section>
          ) : null}

          <section
            id="weekly-bottom-cta"
            className="card-surface-muted mt-10 scroll-mt-28 px-5 py-6 md:mt-12 md:px-6 md:py-7"
          >
            <p className="text-sm leading-relaxed text-slate-700">
              每周一封，30 分钟把握 AI 世界的关键信号。
            </p>
            <Link to="/#subscribe" className="btn-primary mt-4 inline-flex no-underline">
              订阅周报
            </Link>
          </section>

          <Link to="/archive" className="mt-8 inline-block text-sm font-medium text-primary hover:underline">
            ← 历史归档
          </Link>
        </div>

        <aside className="hidden w-[252px] shrink-0 lg:block">
          <div className="sticky top-20">
            <WeeklyToc items={tocItems} />
          </div>
        </aside>
      </div>
    </div>
  );
}
