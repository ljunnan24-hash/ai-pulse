import { useEffect, useState } from 'react';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { fetchEventDetail, type EventDetailResponse } from '../../api/public';
import { ActionBadge } from '../common/ActionBadge';
import { ScoreBadge } from '../common/ScoreBadge';
import { eventDetailPulseScore } from '../../lib/homeRankingsDisplay';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

const detailCache = new Map<number, EventDetailResponse>();

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

function DrawerSkeleton() {
  return (
    <div className="space-y-5 p-5 md:p-6">
      <div className="h-5 w-24 rounded-full bg-slate-100" />
      <div className="space-y-3">
        <div className="h-8 w-5/6 rounded-xl bg-slate-100" />
        <div className="h-5 w-2/3 rounded-xl bg-slate-100" />
      </div>
      <div className="h-28 rounded-[18px] bg-slate-100" />
      <div className="h-40 rounded-[18px] bg-slate-100" />
      <div className="h-32 rounded-[18px] bg-slate-100" />
    </div>
  );
}

function ProseBlock({ title, eyebrow, text }: { title: string; eyebrow: string; text: string }) {
  const body = text.trim();
  if (!body) return null;
  return (
    <section className="border-t border-[#E5ECF5] px-5 py-5 md:px-6">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-1 font-headline text-lg font-bold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.75] text-slate-700">
        {body.split('\n').map((p, idx) => (
          <p key={idx} className="[overflow-wrap:anywhere]">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

export function EventDetailDrawer({ eventId, onClose }: { eventId: number; onClose: () => void }) {
  const cached = detailCache.get(eventId) ?? null;
  const [data, setData] = useState<EventDetailResponse | null>(cached);
  const [isLoading, setIsLoading] = useState(!cached);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const nextCached = detailCache.get(eventId) ?? null;
    setData(nextCached);
    setIsLoading(!nextCached);
    setIsError(false);

    fetchEventDetail(eventId)
      .then((detail) => {
        if (cancelled) return;
        detailCache.set(eventId, detail);
        setData(detail);
        setIsError(false);
      })
      .catch(() => {
        if (!cancelled && !nextCached) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const split = data ? splitTitleForDisplay(data.title) : null;
  const titleZh = (data?.title_zh ?? '').trim();
  const rawTitle = (data?.title ?? '').trim();
  const headlinePrimary = data ? titleZh || split?.primary || rawTitle : '';
  const headlineSecondary =
    data && titleZh && rawTitle && titleZh !== rawTitle
      ? rawTitle
      : split?.secondary
        ? split.secondary
        : undefined;
  const happened = (data?.what_happened ?? '').trim() || rawTitle;
  const primarySource = data?.sources?.[0];
  const primaryHost = primarySource?.url ? safeHostname(primarySource.url) : '';

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="事件详情">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
        aria-label="关闭详情"
        onClick={onClose}
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col overflow-hidden bg-[#F8FAFC] shadow-[-24px_0_48px_rgba(15,23,42,0.2)] md:w-[min(760px,88vw)]">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#D8E2F0] bg-white px-4 md:px-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">事件详情</p>
            <p className="truncate text-sm text-slate-500">排行榜保持在原位置</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={`/events/${eventId}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="打开完整详情页"
              title="打开完整详情页"
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              aria-label="关闭详情"
              title="关闭详情"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isLoading && !data ? <DrawerSkeleton /> : null}

          {isError && !data ? (
            <div className="p-5 md:p-6">
              <div className="rounded-[18px] border border-rose-100 bg-white p-5 text-sm text-slate-700">
                <p className="font-headline text-lg font-bold text-slate-900">暂时无法加载详情</p>
                <p className="mt-2 leading-relaxed">可以稍后重试，或打开完整详情页查看。</p>
              </div>
            </div>
          ) : null}

          {data ? (
            <div className="pb-8">
              <section className="bg-white px-5 py-6 md:px-6 md:py-7">
                <div className="flex flex-wrap items-center gap-2">
                  <ScoreBadge score={eventDetailPulseScore(data)} variant="subtle" />
                  <ActionBadge suggestion={data.action_suggestion} />
                  <span className="text-xs font-medium text-slate-500">
                    {data.published_at ? new Date(data.published_at).toLocaleDateString('zh-CN') : '日期未知'}
                  </span>
                </div>

                <h2 className="mt-4 font-headline text-[24px] font-extrabold leading-[1.32] text-slate-950 [overflow-wrap:anywhere] md:text-[28px]">
                  {headlinePrimary}
                </h2>
                {headlineSecondary ? (
                  <p className="mt-2 text-[13px] font-medium leading-[1.55] text-slate-500 [overflow-wrap:anywhere]">
                    {headlineSecondary}
                  </p>
                ) : null}

                {Array.isArray(data.industry_tags) && data.industry_tags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {data.industry_tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag.slug}
                        className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/90"
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {primarySource ? (
                  <a
                    href={primarySource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-blue-700 no-underline hover:bg-sky-100"
                  >
                    <span className="truncate">{primarySource.source_name || primaryHost || '打开主来源'}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </a>
                ) : null}
              </section>

              <div className="mt-3 overflow-hidden border-y border-[#E5ECF5] bg-white">
                <ProseBlock title="发生了什么" eyebrow="信息说明" text={happened} />
                <ProseBlock title="为什么值得关注" eyebrow="价值提示" text={data.why_important ?? ''} />
                <ProseBlock title="对你意味着什么" eyebrow="辅助理解" text={data.what_it_means_for_you ?? ''} />
              </div>

              <section className="mt-3 bg-white px-5 py-5 md:px-6">
                <h3 className="font-headline text-lg font-bold text-slate-900">来源</h3>
                <ul className="mt-3 divide-y divide-[#E5ECF5] rounded-[18px] border border-[#D8E2F0] bg-white">
                  {(data.sources ?? []).slice(0, 5).map((source, idx) => {
                    const host = safeHostname(source.url ?? '');
                    return (
                      <li key={`${source.url}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{source.source_name || host || '未命名来源'}</p>
                          {host ? <p className="mt-0.5 truncate text-xs text-slate-500">{host}</p> : null}
                        </div>
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-sm font-semibold text-blue-600 no-underline hover:underline"
                          >
                            打开
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}