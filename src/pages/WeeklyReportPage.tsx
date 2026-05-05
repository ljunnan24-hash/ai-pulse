import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

import { fetchWeeklyByDate } from '../api/public';

export default function WeeklyReportPage() {
  const { date } = useParams<{ date: string }>();
  const [title, setTitle] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    setErr(null);
    fetchWeeklyByDate(date)
      .then((r) => {
        setTitle(r.title);
        setReportDate(r.report_date);
        setPayload(r.payload);
      })
      .catch((e: Error) => setErr(e.message));
  }, [date]);

  if (!date) {
    return <p className="text-on-surface-variant pt-8">缺少日期参数</p>;
  }
  if (err) {
    return (
      <div className="max-w-4xl mx-auto pt-8">
        <p className="text-red-600">{err}</p>
        <Link to="/archive" className="text-primary mt-4 inline-block">
          返回归档
        </Link>
      </div>
    );
  }
  if (!payload) {
    return <p className="text-on-surface-variant pt-8">加载中…</p>;
  }

  const normal = (payload.normal as Record<string, unknown> | undefined) || {};
  const thesis = normal.weekly_thesis as
    | { headline?: string; summary?: string; trend_lines?: string[] }
    | undefined;
  const top3Judgments = (normal.top3_judgments as Array<Record<string, string>> | undefined) || [];
  const legacyTop3 = (normal.top3 as Array<Record<string, string>> | undefined) || [];
  const capsBoundaries =
    (normal.capability_boundaries as Array<Record<string, string>> | undefined) || [];
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

  return (
    <div className="max-w-4xl mx-auto pt-8 pb-20 space-y-12">
      <header>
        <p className="text-sm text-on-surface-variant mb-2">{reportDate}</p>
        <h1 className="font-headline font-extrabold text-4xl text-on-surface">{title || 'AI 判断报告'}</h1>
      </header>

      {thesis?.headline ? (
        <section>
          <h2 className="font-headline font-bold text-2xl mb-4">本周一句话判断</h2>
          <div className="rounded-2xl border border-outline-variant/15 p-6 bg-surface-container-low space-y-3">
            <p className="font-headline font-bold text-xl text-on-surface">{thesis.headline}</p>
            {thesis.summary ? (
              <p className="text-on-surface-variant leading-relaxed">{thesis.summary}</p>
            ) : null}
            {Array.isArray(thesis.trend_lines) && thesis.trend_lines.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-on-surface">
                {thesis.trend_lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">{showJudgments ? '本周三个关键判断' : 'Top 3'}</h2>
        <div className="space-y-6">
          {showJudgments
            ? top3Judgments.map((t, i) => (
                <div
                  key={`${t.title}-${i}`}
                  className="rounded-2xl border border-outline-variant/15 p-6 bg-surface-container-low space-y-2"
                >
                  <h3 className="font-headline font-bold text-xl">{t.title}</h3>
                  {t.what_happened ? (
                    <p className="text-on-surface-variant text-sm">
                      <span className="font-medium text-on-surface">事实：</span>
                      {t.what_happened}
                    </p>
                  ) : null}
                  {t.why_it_matters ? (
                    <p className="text-on-surface text-sm">
                      <span className="font-medium">为何重要：</span>
                      {t.why_it_matters}
                    </p>
                  ) : null}
                  {t.who_should_care ? (
                    <p className="text-sm text-on-surface-variant">
                      <span className="font-medium text-on-surface">谁该关心：</span>
                      {t.who_should_care}
                    </p>
                  ) : null}
                  {t.what_to_do_now ? (
                    <p className="text-on-surface font-medium">
                      <span className="text-on-surface-variant font-normal">现在怎么做：</span>
                      {t.what_to_do_now}
                    </p>
                  ) : null}
                  {t.action_level ? (
                    <p className="text-xs text-primary uppercase tracking-wide">行动级别：{t.action_level}</p>
                  ) : null}
                </div>
              ))
            : legacyTop3.map((t, i) => (
                <div key={`${t.url}-${i}`} className="rounded-2xl border border-outline-variant/15 p-6 bg-surface-container-low">
                  <h3 className="font-headline font-bold text-xl">{t.title}</h3>
                  <p className="text-on-surface-variant mt-2">{t.what_happened}</p>
                  <p className="text-on-surface mt-2">{t.what_it_means_for_you}</p>
                </div>
              ))}
        </div>
      </section>

      {radarData.length > 0 ? (
        <section>
          <h2 className="font-headline font-bold text-2xl mb-4">{radar?.title || 'AI 能力雷达'}</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="80%">
                <PolarGrid />
                <PolarAngleAxis dataKey="dim" />
                <Radar name="本期" dataKey="score" stroke="#005bc1" fill="#005bc1" fillOpacity={0.35} />
                <Radar name="基线" dataKey="baseline" stroke="#888" fill="#888" fillOpacity={0.1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">能力边界</h2>
        <div className="space-y-4">
          {showCapsV2
            ? capsBoundaries.map((c, i) => (
                <div key={i} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-container-low space-y-2">
                  <h3 className="font-bold">{c.question}</h3>
                  {c.conclusion ? (
                    <p className="text-sm text-on-surface font-medium">结论：{c.conclusion}</p>
                  ) : null}
                  {c.recommendation ? (
                    <p className="text-sm text-on-surface-variant">建议：{c.recommendation}</p>
                  ) : null}
                  {c.confidence ? (
                    <p className="text-xs text-on-surface-variant">置信：{c.confidence}</p>
                  ) : null}
                </div>
              ))
            : caps.map((c, i) => (
                <div key={i} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-container-low">
                  <h3 className="font-bold">{c.theme}</h3>
                  <p className="text-sm text-on-surface-variant mt-1">{c.conclusion}</p>
                </div>
              ))}
        </div>
      </section>

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">{showToolsV2 ? '本周值得试的工具' : '工具'}</h2>
        <ul className="space-y-3">
          {showToolsV2
            ? toolsTry.map((t, i) => (
                <li key={i} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-container-low space-y-1">
                  <span className="font-bold">{t.name}</span>
                  {t.what_it_does ? (
                    <p className="text-sm text-on-surface-variant">{t.what_it_does}</p>
                  ) : null}
                  {t.best_for ? (
                    <p className="text-xs text-on-surface-variant">适合：{t.best_for}</p>
                  ) : null}
                  {t.barrier ? (
                    <p className="text-xs text-on-surface-variant">门槛：{t.barrier}</p>
                  ) : null}
                  {t.recommendation ? (
                    <p className="text-sm">{t.recommendation}</p>
                  ) : null}
                  {t.url ? (
                    <a href={t.url} className="text-primary text-sm break-all" target="_blank" rel="noreferrer">
                      {t.url}
                    </a>
                  ) : null}
                </li>
              ))
            : tools.map((t, i) => (
                <li key={i} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-container-low">
                  <span className="font-bold">{t.name}</span>
                  <p className="text-sm mt-2">{t.what_it_means_for_you}</p>
                </li>
              ))}
        </ul>
      </section>

      {noiseIgnore.length > 0 ? (
        <section>
          <h2 className="font-headline font-bold text-2xl mb-4">本周不值得追的噪音</h2>
          <ul className="space-y-3">
            {noiseIgnore.map((n, i) => (
              <li key={i} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-container-low">
                <span className="font-bold">{n.name}</span>
                <p className="text-sm text-on-surface-variant mt-2">{n.why_not_important}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">{showRecapV2 ? '分类趋势回顾' : '分类回顾'}</h2>
        {showRecapV2
          ? categoryRecap.map((row, i) => (
              <div key={i} className="mb-8 space-y-2">
                <h3 className="font-headline font-bold text-lg">{String(row.category ?? '')}</h3>
                {row.trend ? <p className="text-sm text-on-surface leading-relaxed">{String(row.trend)}</p> : null}
                {Array.isArray(row.representative_events) && row.representative_events.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm text-on-surface-variant space-y-1">
                    {(row.representative_events as unknown[]).map((ev, j) => (
                      <li key={j}>{typeof ev === 'string' ? ev : JSON.stringify(ev)}</li>
                    ))}
                  </ul>
                ) : null}
                {row.what_to_watch ? (
                  <p className="text-sm font-medium text-on-surface">后续观察：{String(row.what_to_watch)}</p>
                ) : null}
              </div>
            ))
          : sections.map((sec, i) => (
              <div key={i} className="mb-8">
                <h3 className="font-headline font-bold text-lg mb-2">{sec.title}</h3>
                <ul className="space-y-2">
                  {(sec.items as Array<Record<string, string>>).map((it, j) => (
                    <li key={j} className="text-sm">
                      {it.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
      </section>

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">术语</h2>
        <dl className="space-y-3">
          {glossary.map((g, i) => (
            <div key={i}>
              <dt className="font-bold">{g.term}</dt>
              <dd className="text-sm text-on-surface-variant">{g.explain}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link to="/archive" className="text-primary font-medium">
        ← 历史归档
      </Link>
    </div>
  );
}
