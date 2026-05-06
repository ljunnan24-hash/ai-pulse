import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchEventDetail } from '../api/public';
import type { EventDetailResponse } from '../api/public';
import { EVENT_DETAIL_PROSE, EVENT_DETAIL_PROSE_MUTED } from '../components/common/eventDetailProse';
import { ActionBadge } from '../components/common/ActionBadge';
import { ScoreBadge } from '../components/common/ScoreBadge';
import { SectionCard } from '../components/common/SectionCard';
import { CAPABILITY_DIMENSIONS, allCapabilityTagsZero } from '../lib/capabilityTags';
import { categoryLabel } from '../lib/categoryLabels';
import { displayActionSuggestion, displayEventTitle } from '../lib/insightFallback';
import { deriveEventPageHeading } from '../lib/titleDisplay';
import { formatSourceDistribution, hasScoreSourceMix } from '../lib/sourceCoverage';

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [data, setData] = useState<EventDetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(eventId);
    if (!Number.isFinite(id)) {
      setErr('无效的事件 ID');
      return;
    }
    setErr(null);
    fetchEventDetail(id)
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, [eventId]);

  const sourcesUnique = useMemo(() => {
    if (!data?.sources?.length) return [];
    const seen = new Set<string>();
    const out: EventDetailResponse['sources'] = [];
    for (const s of data.sources) {
      const u = (s.url || '').trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(s);
    }
    return out;
  }, [data]);

  if (err) {
    return <p className="pt-8 text-red-600">{err}</p>;
  }
  if (!data) {
    return <p className="pt-8 text-slate-500">加载中…</p>;
  }

  const sb = data.score_breakdown ?? {};
  const capabilityTags = data.capability_tags ?? {};
  const capabilityAllZero = allCapabilityTagsZero(capabilityTags);
  const sourceMixLine = hasScoreSourceMix(sb as Record<string, number>);
  const distributionLine = sourceMixLine ? formatSourceDistribution(sourcesUnique) : null;
  const heading = deriveEventPageHeading(data.title, data.what_happened);

  return (
    <div className="mx-auto grid max-w-7xl min-w-0 gap-10 pb-20 pt-4 md:gap-12 lg:grid-cols-12 lg:pt-6">
      <div className="min-w-0 space-y-8 lg:col-span-8">
        <Link to="/rankings" className="inline-flex text-sm font-semibold text-[#005bc1] hover:underline">
          ← 返回排行榜
        </Link>

        <header className="min-w-0">
          <h1 className="font-headline text-3xl font-extrabold leading-snug tracking-tight text-slate-900 whitespace-normal break-words [overflow-wrap:anywhere] md:text-[2.25rem] md:leading-snug">
            {heading.primary}
          </h1>
          {heading.subtitleLine ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-500 whitespace-normal break-words [overflow-wrap:anywhere]">
              {heading.subtitleLine}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ScoreBadge score={data.ranking_score} variant="pill" />
            <ActionBadge suggestion={data.action_suggestion} className="max-w-full whitespace-normal text-sm px-3 py-1.5" />
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {categoryLabel(data.category)}
            </span>
            <span className="text-sm text-slate-500">
              {data.published_at ? new Date(data.published_at).toLocaleString('zh-CN') : '—'}
            </span>
          </div>
        </header>

        <SectionCard title="发生了什么" eyebrow="判断" detail>
          <p className={EVENT_DETAIL_PROSE_MUTED}>{data.what_happened?.trim() || '—'}</p>
        </SectionCard>

        <SectionCard title="为什么重要" eyebrow="判断" detail>
          <p className={EVENT_DETAIL_PROSE_MUTED}>{data.why_important?.trim() || '—'}</p>
        </SectionCard>

        <SectionCard title="对你意味着什么" eyebrow="判断" detail>
          <p className={EVENT_DETAIL_PROSE}>{data.what_it_means_for_you?.trim() || '—'}</p>
        </SectionCard>

        <SectionCard title="建议" eyebrow="行动" detail>
          <div className="rounded-xl border-2 border-[#005bc1]/25 bg-gradient-to-br from-[#005bc1]/[0.07] to-white px-5 py-6">
            <p className="text-xs font-semibold tracking-wide text-[#004291]">AI Pulse 行动建议</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionBadge
                suggestion={data.action_suggestion}
                className="max-w-full whitespace-normal text-sm px-4 py-2 font-bold"
              />
            </div>
            <p className={`mt-5 ${EVENT_DETAIL_PROSE}`}>{displayActionSuggestion(data.action_suggestion)}</p>
          </div>
        </SectionCard>

        <SectionCard title="来源" eyebrow="可追溯" detail>
          <p className="mb-5 text-sm leading-relaxed text-slate-600">
            下列链接已按 URL 去重，便于核对事实与出处。链接完整展示，可换行阅读。
          </p>
          <ul className="space-y-4">
            {sourcesUnique.map((s) => (
              <li key={s.url} className="rounded-xl border border-slate-200 bg-[#f7f9fc] px-4 py-4">
                <p className="text-sm font-semibold text-slate-800">
                  {s.source_name} · {labelSourceDisplay(s.source_type)}
                </p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-2 block text-sm font-medium text-[#005bc1] underline decoration-[#005bc1]/30 underline-offset-2 hover:decoration-[#005bc1] ${EVENT_DETAIL_PROSE}`}
                >
                  {s.url}
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <aside className="min-w-0 space-y-6 lg:col-span-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-headline font-bold text-slate-900">评分依据</h3>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Pulse Score 在同批次事件中做<strong className="text-slate-700">可比较的加权排序</strong>
            ，综合下方维度；用于提示优先级，而非主观随意打分。
          </p>
          <ul className="mt-5 space-y-2 text-sm text-slate-600">
            <li className="flex justify-between gap-3">
              <span>新鲜度</span>
              <span className="tabular-nums font-medium text-slate-900">{sb.freshness?.toFixed(1) ?? '—'}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>可信度</span>
              <span className="tabular-nums font-medium text-slate-900">{sb.trust?.toFixed(1) ?? '—'}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>热度</span>
              <span className="tabular-nums font-medium text-slate-900">{sb.heat?.toFixed(1) ?? '—'}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>用户价值</span>
              <span className="tabular-nums font-medium text-slate-900">{sb.user_value?.toFixed(1) ?? '—'}</span>
            </li>
            {sourceMixLine ? (
              <li className="border-t border-slate-100 pt-3">
                <div className="flex justify-between gap-3">
                  <span>来源覆盖</span>
                  <span className="tabular-nums font-medium text-slate-900">{sb.source_mix!.toFixed(1)}</span>
                </div>
                {distributionLine ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{distributionLine}</p> : null}
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-headline font-bold text-slate-900">AI 能力影响</h3>
          {capabilityAllZero ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">该事件暂未识别出明确能力影响</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {CAPABILITY_DIMENSIONS.map(({ key, label }) => {
                const raw = Number(capabilityTags[key]);
                const v = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
                const pct = Math.round(v * 100);
                return (
                  <li key={key}>
                    <div className="mb-1.5 flex justify-between text-xs text-slate-600">
                      <span>{label}</span>
                      <span className="tabular-nums font-medium text-slate-900">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-slate-100 bg-slate-100">
                      <div className="h-full rounded-full bg-[#005bc1]/90 transition-[width]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-headline font-bold text-slate-900">相关事件</h3>
          <ul className="mt-3 space-y-2">
            {data.related_events.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/events/${r.id}`}
                  className="block text-sm font-medium leading-relaxed text-[#005bc1] hover:underline [overflow-wrap:anywhere] break-words"
                >
                  {displayEventTitle(r.title)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#005bc1]/15 bg-[#005bc1]/5 p-5">
          <h3 className="font-headline font-bold text-slate-900">订阅周报</h3>
          <p className="mt-2 text-sm text-slate-600">获取每周结构化判断报告，节省筛选信息的时间。</p>
          <Link to="/#subscribe" className="mt-3 inline-block font-semibold text-[#005bc1]">
            去订阅 →
          </Link>
        </div>
      </aside>
    </div>
  );
}

/** 来源类型：与后端 slug 对齐，展示为小写英文标签（与示例 OpenAI · official 一致） */
function labelSourceDisplay(raw: string): string {
  const k = (raw || '').trim().toLowerCase();
  if (!k) return 'unknown';
  return k;
}
