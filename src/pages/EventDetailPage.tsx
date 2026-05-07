import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchEventDetail, type EventDetailResponse } from '../api/public';
import { ScoreBadge } from '../components/common/ScoreBadge';
import { ActionBadge } from '../components/common/ActionBadge';
import { EmptyState } from '../components/common/EmptyState';
import { splitTitleForDisplay } from '../lib/titleDisplay';

function safeHostname(raw: string): string {
  const u = raw.trim();
  if (!u) return '';
  try {
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
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
        <EmptyState title="暂无可展示内容" description="该事件可能已下线或暂时不可用。请稍后从榜单或周报重新进入。" actionLabel="返回首页" actionTo="/" />
      </div>
    );
  }

  const split = splitTitleForDisplay(data.title);
  const why = (data.why_important ?? '').trim();
  const means = (data.what_it_means_for_you ?? '').trim();
  const happenedRaw = (data.what_happened ?? '').trim();
  /** 发生了什么：正文优先，其次标题，再次兜底说明 */
  const happenedBody =
    happenedRaw || (data.title ?? '').trim() || '';

  const sb = data.score_breakdown ?? {};
  const metrics =
    (Number(sb.freshness) || 0) +
    (Number(sb.trust) || 0) +
    (Number(sb.heat) || 0) +
    (Number(sb.source_mix) || 0) +
    (Number(sb.user_value) || 0);

  const primaryLink = data.sources[0];
  const primaryName = (primaryLink?.source_name ?? '').trim();

  const showUnifiedCard = Boolean(happenedBody || why || means);

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
            {/* 顶部事件摘要：事件与简介 + 中文主标题 + 原文标题 + 元信息 + Pulse */}
            <article className="card-surface p-5 md:p-7">
              <p className="text-[12px] font-medium text-[#94A3B8]">事件与简介</p>
              <div className="mt-3 border-t border-[#E5ECF5] pt-5">
                <h1 className="text-balance font-headline text-[22px] font-extrabold leading-[1.35] tracking-tight text-[#0F172A] [overflow-wrap:anywhere] md:text-[24px]">
                  {split.primary}
                </h1>
                {split.secondary ? (
                  <p className="mt-2 text-[13px] font-medium leading-[1.45] text-[#64748B] [overflow-wrap:anywhere]">{split.secondary}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#64748B]">
                  <span className="max-w-[70%] break-words [overflow-wrap:anywhere] sm:max-w-none">
                    {(data.category ?? '').trim() || '—'}
                  </span>
                  <span className="text-[#CBD5E1]">·</span>
                  <span>{data.published_at ? new Date(data.published_at).toLocaleDateString('zh-CN') : '日期未知'}</span>
                  <span className="text-[#CBD5E1]">·</span>
                  <span>{data.sources?.length ?? 0} 条来源</span>
                  {primaryName ? (
                    <>
                      <span className="text-[#CBD5E1]">·</span>
                      <span>主来源 {primaryName}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#E5ECF5] pt-5 text-sm text-slate-600">
                <span>
                  Pulse（排序参考） <ScoreBadge score={data.ranking_score} variant="subtle" />
                </span>
                <ActionBadge suggestion={data.action_suggestion} />
              </div>
            </article>

            {/* 发生了什么 / 为什么值得看 / 对你意味着什么 — 单卡分隔 */}
            {showUnifiedCard ? (
              <article className="card-surface overflow-hidden">
                <div className="divide-y divide-[#E5ECF5]">
                  <div className="px-5 py-6 md:px-7 md:py-7">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">信息说明</p>
                    <h2 className="heading-section mt-1 text-slate-900">发生了什么</h2>
                    <div className="mt-4 space-y-3 text-[15px] leading-[1.75] text-slate-700">
                      {happenedBody ? (
                        happenedRaw ? (
                          happenedRaw.split('\n').map((p, i) => (
                            <p key={i} className="[overflow-wrap:anywhere]">
                              {p}
                            </p>
                          ))
                        ) : (
                          <p className="[overflow-wrap:anywhere]">{happenedBody}</p>
                        )
                      ) : (
                        <p className="text-slate-600">暂无「发生了什么」正文，请结合标题与下方来源核实。</p>
                      )}
                    </div>
                  </div>

                  {why ? (
                    <div className="px-5 py-6 md:px-7 md:py-7">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">价值提示</p>
                      <h2 className="heading-section mt-1 text-slate-900">为什么值得关注</h2>
                      <div className="mt-4 space-y-3 text-[15px] leading-[1.75] text-slate-700">
                        {why.split('\n').map((p, i) => (
                          <p key={i} className="[overflow-wrap:anywhere]">
                            {p}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {means ? (
                    <div className="px-5 py-6 md:px-7 md:py-7">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">辅助理解</p>
                      <h2 className="heading-section mt-1 text-slate-900">对你意味着什么</h2>
                      <div className="mt-4 space-y-3 text-[15px] leading-[1.75] text-slate-700">
                        {means.split('\n').map((p, i) => (
                          <p key={i} className="[overflow-wrap:anywhere]">
                            {p}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ) : (
              <section className="card-surface p-5 md:p-6">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">信息说明</p>
                <h2 className="heading-section mt-1 text-slate-900">事件摘要</h2>
                <p className="mt-4 text-[15px] leading-relaxed text-slate-700">暂无结构化正文，请以标题与下方来源为准。</p>
              </section>
            )}

            <section className="card-surface p-5 md:p-6">
              <h2 className="heading-section text-slate-900">来源</h2>
              <p className="mt-1 text-sm text-slate-600">以下按可信度与日期排序；请以来源媒体/机构的表述为准并自行交叉核对。</p>
              {!data.sources || data.sources.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">暂无来源信息。请以标题与其他渠道自行核实。</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#E5ECF5] rounded-[var(--radius-card)] border border-[#D8E2F0] bg-white">
                  {data.sources.map((s, i) => {
                    const urlStr = (s.url ?? '').trim();
                    const host = urlStr ? safeHostname(urlStr) : '';
                    const name = (s.source_name ?? '').trim();
                    return (
                      <li key={`${urlStr || 'src'}-${i}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                            {name || '未命名来源'}
                          </div>
                          {host ? (
                            <div className="mt-0.5 text-xs text-slate-500">{host}</div>
                          ) : null}
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
                              打开来源
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
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Pulse Score（参考）</div>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ['新鲜度', sb.freshness],
                  ['可信度', sb.trust],
                  ['热度', sb.heat],
                  ['来源多样性', sb.source_mix],
                  ['对你价值', sb.user_value],
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
                {Object.entries(data.capability_tags ?? {}).map(([key, value]) => {
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

            {data.related_events && data.related_events.length > 0 ? (
              <div className="card-surface p-5">
                <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">同类相关</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {data.related_events.map((ev) => (
                    <li key={ev.id}>
                      <Link to={`/events/${ev.id}`} className="nav-link block rounded-lg px-2 py-1.5 text-slate-800 no-underline hover:bg-slate-50">
                        <div className="font-medium leading-snug [overflow-wrap:anywhere]">{ev.title ?? '—'}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <ScoreBadge score={ev.ranking_score} variant="subtle" />
                          <span className="break-words">{(ev.category ?? '').trim() || '—'}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="card-surface-muted p-5 text-sm text-slate-600">
              <div className="font-semibold text-slate-800">获取每周 AI 信号简报</div>
              <p className="mt-2 leading-relaxed">
                完整周报与归档可通过首页与周报入口访问；订阅后按节奏接收整理，不在此页收集邮箱。
              </p>
              <Link to="/subscribe" className="btn-secondary mt-4 inline-flex w-full justify-center py-2 text-xs font-semibold no-underline md:text-sm">
                前往订阅
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
