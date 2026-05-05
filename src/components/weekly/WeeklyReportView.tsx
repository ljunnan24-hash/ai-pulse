import { Link } from 'react-router-dom';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

import { ActionBadge } from '../common/ActionBadge';
import { ScoreBadge } from '../common/ScoreBadge';
import { SectionCard } from '../common/SectionCard';

export type WeeklyReportViewProps = {
  title: string;
  reportDate: string;
  payload: Record<string, unknown>;
};

function fmtBoundaryField(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join('；');
  return String(v);
}

export function WeeklyReportView({ title, reportDate, payload }: WeeklyReportViewProps) {
  const normal = (payload.normal as Record<string, unknown> | undefined) || {};
  const thesis = normal.weekly_thesis as
    | { headline?: string; summary?: string; trend_lines?: string[] }
    | undefined;
  const top3Judgments = (normal.top3_judgments as Array<Record<string, string>> | undefined) || [];
  const legacyTop3 = (normal.top3 as Array<Record<string, string>> | undefined) || [];
  const capsBoundaries =
    (normal.capability_boundaries as Array<Record<string, unknown>> | undefined) || [];
  const caps = (normal.capabilities as Array<Record<string, string>> | undefined) || [];
  const toolsTry = (normal.tools_to_try as Array<Record<string, string>> | undefined) || [];
  const tools = (normal.tools as Array<Record<string, string>> | undefined) || [];
  const noiseIgnore = (normal.noise_to_ignore as Array<Record<string, string>> | undefined) || [];
  const categoryRecap =
    (normal.category_recap as Array<Record<string, unknown>> | undefined) || [];
  const sections = (normal.sections as Array<{ title: string; items: unknown[] }> | undefined) || [];
  const glossary = (payload.glossary as Array<{ term: string; explain: string }> | undefined) || [];

  const showJudgments = top3Judgments.length > 0;
  const showCapsV2 = capsBoundaries.length > 0;
  const showToolsV2 = toolsTry.length > 0;
  const showRecapV2 = categoryRecap.length > 0;
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

  const pulseFromJudgment = (j: Record<string, string>) => {
    const n = Number(j.pulse_score);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="mx-auto max-w-3xl pb-20 pt-6 md:max-w-4xl">
      <header className="mb-10 border-b border-slate-200/80 pb-8">
        <p className="text-sm font-medium text-slate-500">{reportDate}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#005bc1]/80">本周 AI 判断报告</p>
        <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          {title || 'AI Pulse 判断报告'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          不是资讯合集，而是一周信号背后的<strong className="text-slate-800">判断、边界与行动建议</strong>
          ，帮你节省时间。
        </p>
      </header>

      {thesis?.headline ? (
        <section className="mb-12">
          <div className="relative overflow-hidden rounded-3xl border border-[#005bc1]/20 bg-gradient-to-br from-white via-[#005bc1]/[0.04] to-white p-8 shadow-[0_12px_40px_rgba(0,91,193,0.08)] md:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#005bc1]">本周一句话判断</p>
            <p className="mt-4 font-headline text-2xl font-bold leading-snug text-slate-900 md:text-3xl">{thesis.headline}</p>
            {thesis.summary ? (
              <p className="mt-4 text-base leading-relaxed text-slate-700">{thesis.summary}</p>
            ) : null}
            {Array.isArray(thesis.trend_lines) && thesis.trend_lines.length > 0 ? (
              <ul className="mt-6 space-y-2 border-t border-slate-200/80 pt-6">
                {thesis.trend_lines.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="font-bold text-[#005bc1]">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mb-12">
        <h2 className="mb-6 font-headline text-2xl font-bold text-slate-900">
          {showJudgments ? '本周最重要的 3 个判断' : '本周重点'}
        </h2>
        <div className="space-y-6">
          {showJudgments
            ? top3Judgments.map((t, i) => (
                <SectionCard key={`${t.title}-${i}`} className="!bg-slate-50/50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-headline text-xl font-bold text-slate-900">{t.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {t.action_level ? <ActionBadge suggestion={t.action_level} /> : null}
                      {pulseFromJudgment(t) > 0 ? (
                        <ScoreBadge score={pulseFromJudgment(t)} label="Pulse" />
                      ) : null}
                    </div>
                  </div>
                  <dl className="mt-4 space-y-3 text-sm">
                    {t.what_happened ? (
                      <div>
                        <dt className="font-semibold text-slate-800">发生了什么</dt>
                        <dd className="mt-1 text-slate-600">{t.what_happened}</dd>
                      </div>
                    ) : null}
                    {t.why_it_matters ? (
                      <div>
                        <dt className="font-semibold text-slate-800">为什么重要</dt>
                        <dd className="mt-1 text-slate-700">{t.why_it_matters}</dd>
                      </div>
                    ) : null}
                    {t.who_should_care ? (
                      <div>
                        <dt className="font-semibold text-slate-800">谁应该关注</dt>
                        <dd className="mt-1 text-slate-600">{t.who_should_care}</dd>
                      </div>
                    ) : null}
                    {t.what_to_do_now ? (
                      <div className="rounded-xl border border-[#005bc1]/15 bg-white px-4 py-3">
                        <dt className="text-xs font-bold uppercase tracking-wide text-[#005bc1]">现在怎么做</dt>
                        <dd className="mt-1 font-medium text-slate-900">{t.what_to_do_now}</dd>
                      </div>
                    ) : null}
                  </dl>
                </SectionCard>
              ))
            : legacyTop3.map((t, i) => (
                <SectionCard key={`${t.url}-${i}`}>
                  <h3 className="font-headline text-xl font-bold">{t.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{t.what_happened}</p>
                  <p className="mt-2 text-slate-800">{t.what_it_means_for_you}</p>
                  <div className="mt-3">
                    <ActionBadge suggestion="先观望" />
                  </div>
                </SectionCard>
              ))}
        </div>
      </section>

      {radarData.length > 0 ? (
        <section className="mb-12">
          <h2 className="mb-4 font-headline text-2xl font-bold text-slate-900">{radar?.title || 'AI 能力雷达'}</h2>
          <div className="h-72 w-full rounded-2xl border border-slate-200 bg-white p-4">
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

      <section className="mb-12">
        <h2 className="mb-6 font-headline text-2xl font-bold text-slate-900">AI 能力边界</h2>
        <div className="space-y-5">
          {showCapsV2
            ? capsBoundaries.map((c, i) => (
                <SectionCard key={i}>
                  <h3 className="font-headline text-lg font-bold text-slate-900">{String(c.question ?? '')}</h3>
                  {c.conclusion ? (
                    <div className="mt-3 rounded-xl border border-[#005bc1]/20 bg-[#005bc1]/5 px-4 py-3 text-sm font-semibold text-slate-900">
                      结论：{String(c.conclusion)}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                    {fmtBoundaryField(c.can_do) ? (
                      <div>
                        <p className="font-semibold text-emerald-800">已经能做到</p>
                        <p className="mt-1 text-slate-600">{fmtBoundaryField(c.can_do)}</p>
                      </div>
                    ) : null}
                    {fmtBoundaryField(c.cannot_do) ? (
                      <div>
                        <p className="font-semibold text-rose-800">还做不到</p>
                        <p className="mt-1 text-slate-600">{fmtBoundaryField(c.cannot_do)}</p>
                      </div>
                    ) : null}
                  </div>
                  {c.best_for ? (
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="font-medium text-slate-800">适合谁：</span>
                      {String(c.best_for)}
                    </p>
                  ) : null}
                  {c.recommendation ? (
                    <p className="mt-2 text-sm font-medium text-slate-800">建议：{String(c.recommendation)}</p>
                  ) : null}
                  {c.confidence ? (
                    <p className="mt-2 text-xs text-slate-500">置信：{String(c.confidence)}</p>
                  ) : null}
                </SectionCard>
              ))
            : caps.map((c, i) => (
                <SectionCard key={i}>
                  <h3 className="font-bold text-slate-900">{c.theme}</h3>
                  <p className="mt-2 text-sm text-slate-600">{c.conclusion}</p>
                </SectionCard>
              ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 font-headline text-2xl font-bold text-slate-900">
          {showToolsV2 ? '本周值得试的工具' : '工具参考'}
        </h2>
        <ul className="space-y-4">
          {showToolsV2
            ? toolsTry.map((t, i) => (
                <li key={i}>
                  <SectionCard>
                    <span className="font-headline text-lg font-bold text-slate-900">{t.name}</span>
                    {t.what_it_does ? <p className="mt-2 text-sm text-slate-600">{t.what_it_does}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      {t.best_for ? <span>适合：{t.best_for}</span> : null}
                      {t.barrier ? <span>门槛：{t.barrier}</span> : null}
                    </div>
                    {t.recommendation ? (
                      <p className="mt-3 text-sm font-medium text-slate-800">{t.recommendation}</p>
                    ) : null}
                    {t.url ? (
                      <a href={t.url} className="mt-2 inline-block text-sm text-[#005bc1] break-all" target="_blank" rel="noreferrer">
                        {t.url}
                      </a>
                    ) : null}
                  </SectionCard>
                </li>
              ))
            : tools.map((t, i) => (
                <li key={i}>
                  <SectionCard>
                    <span className="font-bold">{t.name}</span>
                    <p className="mt-2 text-sm">{t.what_it_means_for_you}</p>
                  </SectionCard>
                </li>
              ))}
        </ul>
      </section>

      {noiseIgnore.length > 0 ? (
        <section className="mb-12">
          <h2 className="mb-2 font-headline text-2xl font-bold text-slate-900">本周可以忽略的噪音</h2>
          <p className="mb-6 text-sm text-slate-600">节省注意力：热闹不等于值得你投入时间。</p>
          <ul className="space-y-4">
            {noiseIgnore.map((n, i) => (
              <li
                key={i}
                className="rounded-2xl border border-slate-200 bg-slate-100/80 px-5 py-4 text-slate-700 shadow-inner"
              >
                <span className="font-headline font-semibold text-slate-800">{n.name}</span>
                <p className="mt-2 text-sm leading-relaxed">{n.why_not_important}</p>
                <p className="mt-3 text-xs font-medium text-slate-500">建议：可以忽略</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-12">
        <h2 className="mb-6 font-headline text-2xl font-bold text-slate-900">
          {showRecapV2 ? '分类回顾' : '分类回顾'}
        </h2>
        {showRecapV2
          ? categoryRecap.map((row, i) => (
              <div key={i} className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-headline text-lg font-bold text-[#005bc1]">{String(row.category ?? '')}</h3>
                {row.trend ? <p className="mt-3 text-sm leading-relaxed text-slate-700">{String(row.trend)}</p> : null}
                {Array.isArray(row.representative_events) && row.representative_events.length > 0 ? (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {(row.representative_events as unknown[]).map((ev, j) => (
                      <li key={j}>{typeof ev === 'string' ? ev : JSON.stringify(ev)}</li>
                    ))}
                  </ul>
                ) : null}
                {row.what_to_watch ? (
                  <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-medium text-slate-800">
                    后续看什么：{String(row.what_to_watch)}
                  </p>
                ) : null}
              </div>
            ))
          : sections.map((sec, i) => (
              <div key={i} className="mb-8">
                <h3 className="font-headline text-lg font-bold">{sec.title}</h3>
                <ul className="mt-3 space-y-2">
                  {(sec.items as Array<Record<string, string>>).map((it, j) => (
                    <li key={j} className="text-sm text-slate-600">
                      {it.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
      </section>

      <section className="mb-12">
        <h2 className="mb-6 font-headline text-2xl font-bold text-slate-900">本周术语</h2>
        <dl className="space-y-4">
          {glossary.map((g, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <dt className="font-headline font-bold text-slate-900">{g.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600">{g.explain}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="rounded-2xl border border-[#005bc1]/15 bg-[#005bc1]/5 p-6 text-center md:text-left">
        <p className="text-sm text-slate-700">想用邮件收到每期判断报告？</p>
        <Link to="/" className="mt-2 inline-block font-headline font-bold text-[#005bc1]">
          前往订阅 →
        </Link>
      </div>

      <Link to="/archive" className="mt-10 inline-block text-sm font-medium text-[#005bc1]">
        ← 历史归档
      </Link>
    </div>
  );
}
