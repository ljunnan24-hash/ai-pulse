import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchEventDetail, type EventDetailResponse } from '../api/public';
import { ScoreBadge } from '../components/common/ScoreBadge';
import { ActionBadge } from '../components/common/ActionBadge';
import { EmptyState } from '../components/common/EmptyState';
import { deriveEventPageHeading, splitTitleForDisplay } from '../lib/titleDisplay';

function safeHostname(raw: string): string {
  const u = raw.trim();
  if (!u) return '';
  try {
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return u.length > 56 ? `${u.slice(0, 56)}…` : u;
  }
}

function splitSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const parts = t.split(/(?<=[。！？!?])\s*/).filter(Boolean);
  return parts.length ? parts : [t];
}

/** 顶部主判断标题：one_liner → why → means → happened → 解析标题（与榜单逻辑一致） */
function leadHeadline(data: EventDetailResponse): string {
  const one = data.one_liner?.trim();
  if (one) return one;
  const pick = (s: string, max = 160) => {
    const p = s.trim();
    if (!p) return '';
    const first = splitSentences(p)[0] ?? p;
    return first.length > max ? `${first.slice(0, max).trim()}…` : first;
  };
  const whyFull = data.why_important?.trim();
  if (whyFull) return pick(whyFull);
  const m = pick(data.what_it_means_for_you);
  if (m) return m;
  const h = pick(data.what_happened);
  if (h) return h;
  return deriveEventPageHeading(data.title, data.what_happened).primary;
}

export default function EventDetailPage() {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>();
  const eventId = Number(eventIdParam);

  const [data, setData] = useState<EventDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(eventId)) {
      setIsLoading(false);
      setIsError(true);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    fetchEventDetail(eventId)
      .then((d) => {
        setData(d);
        setIsError(false);
      })
      .catch(() => {
        setData(null);
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  }, [eventId]);

  if (!Number.isFinite(eventId)) {
    return (
      <div className="page-container section-y">
        <EmptyState title="无效的事件 ID" description="请从排行榜或周报返回并重新进入。" actionLabel="返回首页" actionTo="/" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-container section-y">
        <div className="card-surface-muted h-40 animate-pulse rounded-[var(--radius-card)]" aria-hidden />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page-container section-y">
        <EmptyState title="暂无可展示判断" description="该事件可能已下线或暂时不可用。稍后回来查看新的 AI 信号。" actionLabel="返回首页" actionTo="/" />
      </div>
    );
  }

  const headingMeta = deriveEventPageHeading(data.title, data.what_happened);
  const split = splitTitleForDisplay(data.title);
  const mainJudgment = leadHeadline(data);
  const showOriginalTitle = Boolean(headingMeta.subtitleLine) || mainJudgment.trim() !== data.title.trim() || Boolean(split.secondary);

  const why = data.why_important.trim();
  const means = data.what_it_means_for_you.trim();
  const happened = data.what_happened.trim();

  const sb = data.score_breakdown;
  const metrics =
    (Number(sb.freshness) || 0) +
    (Number(sb.trust) || 0) +
    (Number(sb.heat) || 0) +
    (Number(sb.source_mix) || 0) +
    (Number(sb.user_value) || 0);

  /** 后端按可信度与日期排序，首条视为优先核对来源 */
  const primaryLink = data.sources[0];
  const primaryHost = primaryLink?.url ? safeHostname(primaryLink.url) : '';

  return (
    <div className="page-container section-y pb-16 md:pb-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link to="/rankings" className="btn-secondary px-4 py-2 text-sm font-semibold no-underline">
            ← 返回排行榜
          </Link>
          <Link to="/" className="btn-secondary px-4 py-2 text-sm font-semibold no-underline">
            首页
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-6">
            <article className="card-surface p-5 md:p-7">
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span className="max-w-[70%] break-words [overflow-wrap:anywhere] sm:max-w-none">{data.category}</span>
                <span className="text-slate-300">·</span>
                <span>{data.published_at ? new Date(data.published_at).toLocaleDateString('zh-CN') : '日期未知'}</span>
                <span className="text-slate-300">·</span>
                <span>{data.sources.length} 条来源</span>
                {primaryHost ? (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="normal-case tracking-normal text-slate-600">主来源 {primaryHost}</span>
                  </>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Pulse</span>
                <ScoreBadge score={data.ranking_score} variant="subtle" />
                <ActionBadge suggestion={data.action_suggestion} />
              </div>

              <h1 className="mt-5 text-balance text-xl font-bold leading-snug text-slate-900 line-clamp-5 [overflow-wrap:anywhere] md:heading-page md:line-clamp-none">
                {mainJudgment}
              </h1>

              {showOriginalTitle ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  <span className="font-medium text-slate-600">原始标题与题注</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {headingMeta.subtitleLine ? (
                    <span>{headingMeta.subtitleLine}</span>
                  ) : split.secondary ? (
                    <>
                      <span className="font-medium text-slate-800">{split.primary}</span>
                      <span className="mx-1 text-slate-300">/</span>
                      <span>{split.secondary}</span>
                    </>
                  ) : (
                    <span>{data.title}</span>
                  )}
                </p>
              ) : null}
            </article>

            {why ? (
              <section className="card-surface p-5 md:p-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">判断报告</p>
                <h2 className="heading-section mt-1 text-slate-900">为什么重要</h2>
                <div className="mt-4 space-y-3 text-body text-slate-700">
                  {why.split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {means ? (
              <section className="card-surface p-5 md:p-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">判断报告</p>
                <h2 className="heading-section mt-1 text-slate-900">对你意味着什么</h2>
                <div className="mt-4 space-y-3 text-body text-slate-700">
                  {means.split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {happened ? (
              <section className="card-surface p-5 md:p-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">判断报告</p>
                <h2 className="heading-section mt-1 text-slate-900">发生了什么</h2>
                <div className="mt-4 space-y-3 text-body text-slate-700">
                  {happened.split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {!why && !means && !happened ? (
              <section className="card-surface p-5 md:p-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">判断报告</p>
                <h2 className="heading-section mt-1 text-slate-900">事件摘要</h2>
                <p className="mt-4 text-body text-slate-700">暂无结构化判断正文，请以标题与来源为准。</p>
              </section>
            ) : null}

            <section className="card-surface-muted p-5 md:p-6">
              <h2 className="heading-section text-slate-900">来源与核实</h2>
              <p className="mt-1 text-sm text-slate-600">优先阅读主来源；交叉比对后再做决策。</p>
              {data.sources.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">暂无来源信息。请以标题与其他渠道自行核实。</p>
              ) : (
                <ul className="mt-4 divide-y divide-[color:var(--border-default)] rounded-[var(--radius-card)] border border-[color:var(--border-default)] bg-white">
                  {data.sources.map((s, i) => {
                    const urlStr = (s.url ?? '').trim();
                    const host = urlStr ? safeHostname(urlStr) : '';
                    return (
                      <li key={`${urlStr || 'src'}-${i}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 font-medium text-slate-900 [overflow-wrap:anywhere]">{s.source_name?.trim() || '来源'}</div>
                          <div className="truncate text-xs text-slate-500">{host || '—'}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {i === 0 ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-800">
                              优先核对
                            </span>
                          ) : null}
                          {urlStr ? (
                            <a
                              href={urlStr}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary px-3 py-1.5 text-xs font-semibold no-underline"
                            >
                              打开链接
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">无链接</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="card-surface p-5">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Pulse 分解</div>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ['新鲜度', data.score_breakdown.freshness],
                  ['可信度', data.score_breakdown.trust],
                  ['热度', data.score_breakdown.heat],
                  ['来源多样性', data.score_breakdown.source_mix],
                  ['对你价值', data.score_breakdown.user_value],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-headline font-semibold tabular-nums text-slate-900">
                      {Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—'}
                    </span>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t border-[color:var(--border-default)] pt-3 text-xs text-slate-500">
                  <span>加权合计（示意）</span>
                  <span className="font-medium tabular-nums text-slate-700">{metrics.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="card-surface p-5">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">能力标签</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(data.capability_tags).map(([key, value]) => {
                  const v = typeof value === 'number' ? value : Number(value);
                  const strong = Number.isFinite(v) && v >= 0.55;
                  return (
                    <span
                      key={key}
                      className={
                        strong
                          ? 'rounded-full border border-[color:var(--border-default)] bg-slate-900 px-2.5 py-1 text-[0.7rem] font-medium text-white'
                          : 'rounded-full border border-[color:var(--border-default)] bg-slate-50 px-2.5 py-1 text-[0.7rem] font-medium text-slate-700'
                      }
                    >
                      {key}: {Number.isFinite(v) ? v.toFixed(2) : '—'}
                    </span>
                  );
                })}
              </div>
            </div>

            {data.related_events.length > 0 ? (
              <div className="card-surface p-5">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">同分类相关</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {data.related_events.map((ev) => (
                    <li key={ev.id}>
                      <Link to={`/events/${ev.id}`} className="nav-link block rounded-lg px-2 py-1.5 text-slate-800 no-underline hover:bg-slate-50">
                        <div className="line-clamp-2 font-medium leading-snug [overflow-wrap:anywhere]">{ev.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <ScoreBadge score={ev.ranking_score} variant="subtle" />
                          <span className="break-words">{ev.category}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="card-surface-muted p-5 text-sm text-slate-600">
              <div className="font-semibold text-slate-800">获取更新节奏</div>
              <p className="mt-2 leading-relaxed">完整周报与归档仍可通过首页与归档入口访问；我们不在这里收集邮箱。</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
