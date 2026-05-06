import { Link } from 'react-router-dom';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

import { SectionHeader } from '../common/SectionHeader';
import { CapabilityBoundaryCard } from './CapabilityBoundaryCard';
import { CategoryRecapCard } from './CategoryRecapCard';
import { GlossaryGrid } from './GlossaryGrid';
import { NoiseCard } from './NoiseCard';
import { TopJudgmentRow } from './TopJudgmentRow';
import { WeeklyReportDirectory } from './WeeklyReportDirectory';
import { ToolTryCard } from './ToolTryCard';
import type { ThesisShape } from './WeeklyThesisCard';
import { ReportCoverCard } from './ReportCoverCard';
import { ReportCoverFallback } from './ReportCoverFallback';
import { WeeklyReportHeader } from './WeeklyReportHeader';
import type { TocItem } from './WeeklyToc';
import { estimateReadingMinutes, normalizeGlossary } from './weeklyPayloadUtils';

export type WeeklyReportViewProps = {
  title: string;
  reportDate: string;
  payload: Record<string, unknown>;
};

const TOC_META: Record<string, { label: string; hint: string; minutes: string }> = {
  'weekly-thesis': {
    label: '本周核心判断与趋势总览',
    hint: '主线结论与一周信号',
    minutes: '约 5 分钟',
  },
  'top3-judgments': {
    label: '本周最重要的 3 个判断',
    hint: '优先行动与 Pulse 排序',
    minutes: '约 8 分钟',
  },
  'capability-boundaries': {
    label: 'AI 能力边界与上限',
    hint: '能力上限与边界案例',
    minutes: '约 6 分钟',
  },
  'capability-radar': {
    label: 'AI 能力雷达',
    hint: '维度对照一览',
    minutes: '约 3 分钟',
  },
  'tools-to-try': {
    label: '本周值得试的工具',
    hint: '可动手试用清单',
    minutes: '约 5 分钟',
  },
  'noise-ignore': {
    label: '本周可忽略的噪音',
    hint: '暂时不必关注的热点',
    minutes: '约 3 分钟',
  },
  'category-recap': {
    label: '分领域要点回顾',
    hint: '模型 / 工具 / 行业等',
    minutes: '约 7 分钟',
  },
  glossary: {
    label: '本周术语速查',
    hint: '关键词一句话弄懂',
    minutes: '约 4 分钟',
  },
};

function tocEntry(id: string): TocItem {
  const m = TOC_META[id];
  return { id, label: m?.label ?? id, hint: m?.hint, minutes: m?.minutes };
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
  tocItems.push(tocEntry('weekly-thesis'));
  if (showJudgments || showLegacyTop3) tocItems.push(tocEntry('top3-judgments'));
  if (showCapsV2 || showCapsLegacy) tocItems.push(tocEntry('capability-boundaries'));
  if (radarData.length > 0) tocItems.push(tocEntry('capability-radar'));
  if (showToolsV2 || showToolsLegacy) tocItems.push(tocEntry('tools-to-try'));
  if (noiseIgnore.length > 0) tocItems.push(tocEntry('noise-ignore'));
  if (showRecapV2 || showRecapLegacy) tocItems.push(tocEntry('category-recap'));
  if (glossaryRows.length > 0) tocItems.push(tocEntry('glossary'));

  const sectionHeaderProps = { className: 'mb-5 md:mb-6' };

  return (
    <div className="page-container bg-slate-50 pb-20 pt-6 md:pt-8">
      <div className="mx-auto max-w-4xl text-sm leading-relaxed text-slate-800 lg:text-[0.95rem] lg:leading-[1.75]">
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

            {showJudgments || showLegacyTop3 ? (
              <div className="card-surface overflow-hidden shadow-[var(--shadow-card)]">
                {showJudgments
                  ? top3Judgments.map((t, i) => (
                      <TopJudgmentRow key={`${t.title}-${i}`} rank={i + 1} row={t} />
                    ))
                  : null}
                {showLegacyTop3
                  ? legacyTop3.map((t, i) => (
                      <TopJudgmentRow
                        key={`legacy-${String(t.url ?? i)}-${i}`}
                        rank={i + 1}
                        row={{
                          title: String(t.title ?? ''),
                          what_happened: String(t.what_happened ?? ''),
                          pulse_score: String(t.pulse_score ?? ''),
                          theme: String(t.theme ?? t.category ?? ''),
                          event_id: String(t.event_id ?? ''),
                        }}
                      />
                    ))
                  : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600">本期暂无 Top3 数据。</p>
            )}
          </section>

          {tocItems.length > 0 ? <WeeklyReportDirectory items={tocItems} /> : null}

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
            className="mt-10 scroll-mt-28 rounded-[var(--radius-card)] border border-[#D6E8FF] bg-[#F0F7FF] px-5 py-7 shadow-[var(--shadow-card)] md:mt-12 md:px-8 md:py-8"
          >
            <p className="font-headline text-base font-semibold text-slate-900 md:text-lg">订阅 AI Pulse 周报，每周洞见不缺席。</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              每周一封，30 分钟把握 AI 世界的关键信号。
            </p>
            <Link to="/#subscribe" className="btn-primary mt-5 inline-flex no-underline">
              订阅周报
            </Link>
            <p className="mt-3 text-xs text-slate-500">已订阅用户将自动收到最新报告（若后端已启用投递）。</p>
          </section>

          <Link to="/archive" className="mt-8 inline-block text-sm font-medium text-primary hover:underline">
            ← 历史归档
          </Link>
      </div>
    </div>
  );
}
