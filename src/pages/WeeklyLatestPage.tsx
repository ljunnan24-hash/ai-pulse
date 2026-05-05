import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

import { fetchWeeklyLatest } from '../api/public';

export default function WeeklyLatestPage() {
  const [title, setTitle] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeklyLatest()
      .then((r) => {
        setTitle(r.title);
        setReportDate(r.report_date);
        setPayload(r.payload);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <div className="max-w-4xl mx-auto pt-8">
        <p className="text-red-600">{err}</p>
        <p className="text-sm text-on-surface-variant mt-4">
          若尚无周报，请先运行 `generate_weekly` 生成并写入 weekly_reports。
        </p>
      </div>
    );
  }
  if (!payload) {
    return <p className="text-on-surface-variant pt-8">加载中…</p>;
  }

  const normal = (payload.normal as Record<string, unknown> | undefined) || {};
  const top3 = (normal.top3 as Array<Record<string, string>> | undefined) || [];
  const caps = (normal.capabilities as Array<Record<string, string>> | undefined) || [];
  const tools = (normal.tools as Array<Record<string, string>> | undefined) || [];
  const sections = (normal.sections as Array<{ title: string; items: unknown[] }> | undefined) || [];
  const glossary = (payload.glossary as Array<{ term: string; explain: string }> | undefined) || [];
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
        <h1 className="font-headline font-extrabold text-4xl text-on-surface">{title || '本周 AI 判断报告'}</h1>
      </header>

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">本周最重要的判断（Top 3）</h2>
        <div className="space-y-6">
          {top3.map((t, i) => (
            <div key={`${t.url}-${i}`} className="rounded-2xl border border-outline-variant/15 p-6 bg-surface-container-low">
              <h3 className="font-headline font-bold text-xl text-on-surface">{t.title}</h3>
              <p className="text-on-surface-variant mt-2">{t.what_happened}</p>
              <p className="text-on-surface mt-2">{t.what_it_means_for_you}</p>
              {t.url ? (
                <a href={t.url} className="text-primary text-sm mt-3 inline-block" target="_blank" rel="noreferrer">
                  打开链接
                </a>
              ) : null}
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
          {caps.map((c, i) => (
            <div key={i} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-container-low">
              <h3 className="font-bold">{c.theme}</h3>
              <p className="text-sm text-on-surface-variant mt-1">{c.conclusion}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">值得试的工具</h2>
        <ul className="space-y-3">
          {tools.map((t, i) => (
            <li key={i} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-container-low">
              <span className="font-bold">{t.name}</span>
              <span className="text-sm text-on-surface-variant ml-2">{t.worth_trying}</span>
              <p className="text-sm mt-2">{t.what_it_means_for_you}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-headline font-bold text-2xl mb-4">分类回顾</h2>
        {sections.map((sec, i) => (
          <div key={i} className="mb-8">
            <h3 className="font-headline font-bold text-lg mb-2">{sec.title}</h3>
            <ul className="space-y-2">
              {(sec.items as Array<Record<string, string>>).map((it, j) => (
                <li key={j} className="text-sm text-on-surface-variant">
                  <span className="text-on-surface font-medium">{it.title}</span> — {it.what_happened}
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

      <div className="rounded-2xl bg-primary-container/30 p-6 border border-primary/10">
        <p className="text-on-surface-variant text-sm mb-3">需要邮件推送完整周报？</p>
        <Link to="/" className="text-primary font-bold">
          前往订阅 →
        </Link>
      </div>
    </div>
  );
}
