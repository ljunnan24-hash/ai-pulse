import { Link } from 'react-router-dom';
import { Layers, Sparkles, TrendingUp, Zap } from 'lucide-react';

import type { ThesisShape } from './WeeklyThesisCard';

type Props = {
  thesis: ThesisShape;
  readingMinutes: number;
  /** 本期要点条目数（展示用） */
  topJudgmentCount: number;
  /** 噪音过滤条数 */
  noiseFilteredCount: number;
};

const PILLAR_ICONS = [Zap, TrendingUp, Layers];

export function ReportCoverCard({ thesis, readingMinutes, topJudgmentCount, noiseFilteredCount }: Props) {
  const lines = Array.isArray(thesis.trend_lines) ? thesis.trend_lines.filter(Boolean) : [];
  const pillars = lines.slice(0, 3);

  return (
    <section id="weekly-thesis" className="mb-8 scroll-mt-28 md:mb-10">
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-slate-200/90 bg-white shadow-[var(--shadow-card)]">
        {/* 左侧浅蓝强调条（目标稿） */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary/35 via-primary/20 to-primary/5"
          aria-hidden
        />

        <div className="relative grid gap-6 p-5 pl-6 md:grid-cols-[minmax(0,1fr)_min(180px,28%)] md:gap-8 md:p-8 md:pl-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
              <span className="text-[0.7rem] font-semibold tracking-wide text-primary">本周最重要的变化</span>
            </div>

            {thesis.headline ? (
              <p className="mt-4 font-headline text-xl font-bold leading-snug tracking-tight text-slate-900 md:text-2xl md:leading-tight">
                {thesis.headline}
              </p>
            ) : null}

            {thesis.summary ? (
              <p className="mt-4 text-sm leading-[1.75] text-slate-600 md:text-[0.95rem] md:leading-[1.8]">{thesis.summary}</p>
            ) : null}

            {pillars.length > 0 ? (
              <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
                {pillars.map((line, i) => {
                  const Icon = PILLAR_ICONS[i % PILLAR_ICONS.length];
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
                      </div>
                      <p className="text-[0.8125rem] leading-snug text-slate-700 [overflow-wrap:anywhere] line-clamp-4">
                        {line}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <p className="mt-5 text-xs text-slate-500">
              阅读约 {readingMinutes} 分钟 · 精选信息 {topJudgmentCount} 条 · 噪音过滤 {noiseFilteredCount} 条
            </p>

            <div className="mt-5">
              <Link to="/#subscribe" className="btn-primary inline-flex px-5 py-2 text-sm font-semibold no-underline">
                订阅周报
              </Link>
            </div>
          </div>

          {/* 右侧轻示意（目标稿插图区） */}
          <div
            className="relative hidden min-h-[10rem] overflow-hidden rounded-xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent ring-1 ring-primary/10 md:block"
            aria-hidden
          >
            <div className="absolute inset-x-6 top-8 h-2 rounded-full bg-primary/15" />
            <div className="absolute inset-x-8 top-14 space-y-2">
              <div className="h-1.5 rounded-full bg-primary/20" />
              <div className="h-1.5 w-[88%] rounded-full bg-primary/12" />
              <div className="h-1.5 w-[72%] rounded-full bg-primary/10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
