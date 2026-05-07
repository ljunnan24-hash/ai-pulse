import { Link } from 'react-router-dom';
import { Heart, ListOrdered, BookOpen } from 'lucide-react';

import { WeeklyReportHeader } from './WeeklyReportHeader';
import { WeeklyJudgmentCard } from './WeeklyJudgmentCard';
import { WeeklyTopThreeList } from './WeeklyTopThreeList';
import { WeeklyBoundaryPairSection, weeklyBoundaryHasContent } from './WeeklyBoundaryPairSection';
import { GlossaryGrid } from './GlossaryGrid';
import {
  enrichWeeklyTopThreeWithLegacyTop3,
  getWeeklyTopThreeJudgments,
  normalizeGlossary,
} from './weeklyPayloadUtils';

export type WeeklyReportViewProps = {
  title: string;
  reportDate: string;
  payload: Record<string, unknown>;
};

/** 周报落地页：四段结构对齐目标稿（本周判断 → 三件事 → 能力边界 → 术语） */
export function WeeklyReportView({ title, reportDate, payload }: WeeklyReportViewProps) {
  const normal = (payload.normal as Record<string, unknown> | undefined) || {};
  const thesis = normal.weekly_thesis as { headline?: string; summary?: string } | undefined;

  const headline = (thesis?.headline ?? '').trim() || title.trim() || '本期周报';

  const topThreeRaw = getWeeklyTopThreeJudgments(payload);
  const topThree = enrichWeeklyTopThreeWithLegacyTop3(topThreeRaw, normal.top3);

  const capsBoundaries =
    (normal.capability_boundaries as Array<Record<string, unknown>> | undefined) || [];
  const capsLegacy = (normal.capabilities as Array<Record<string, string>> | undefined) || [];

  const boundaryRows: Record<string, unknown>[] =
    capsBoundaries.length > 0
      ? capsBoundaries
      : capsLegacy.slice(0, 2).map((c) => ({
          question: c.theme,
          can_do: c.can_do,
          cannot_do: c.cannot_do,
          conclusion: c.conclusion,
        }));

  const glossaryRows = normalizeGlossary(payload, normal).filter(
    (g) => (g.term ?? '').trim() || (g.explain ?? '').trim(),
  );

  const sectionTitleCls = 'mb-4 flex items-center gap-2 md:mb-5';
  const sectionIconCls = 'h-5 w-5 shrink-0 text-[#2563EB] opacity-90';

  return (
    <div className="bg-[#F8FAFC] pb-20 pt-8 md:pt-10">
      <div className="page-container">
        <div className="mx-auto max-w-5xl px-1 sm:px-0">
          <WeeklyReportHeader reportDate={reportDate} title={title} />

          {/* 1. 本周判断 */}
          <section className="mb-12 md:mb-14">
            <WeeklyJudgmentCard headline={headline} />
          </section>

          {/* 2. 本周最重要的三件事 */}
          <section className="mb-12 md:mb-14">
            <div className={sectionTitleCls}>
              <ListOrdered className={sectionIconCls} strokeWidth={2} aria-hidden />
              <h2 className="font-headline text-[17px] font-bold text-[#2563EB] md:text-lg">本周最重要的三件事</h2>
            </div>
            <WeeklyTopThreeList rows={topThree} />
          </section>

          {/* 3. 本周 AI 能力边界 */}
          <section className="mb-12 md:mb-14">
            <div className={sectionTitleCls}>
              <Heart className={sectionIconCls} strokeWidth={2} aria-hidden />
              <h2 className="font-headline text-[17px] font-bold text-[#2563EB] md:text-lg">本周 AI 能力边界</h2>
            </div>
            {weeklyBoundaryHasContent(boundaryRows) ? (
              <WeeklyBoundaryPairSection rows={boundaryRows} />
            ) : (
              <p className="text-[14px] text-[#64748B]">本期暂无能力边界条目。</p>
            )}
          </section>

          {/* 4. 术语解释 */}
          {glossaryRows.length > 0 ? (
            <section className="mb-10 md:mb-12">
              <div className={sectionTitleCls}>
                <BookOpen className={sectionIconCls} strokeWidth={2} aria-hidden />
                <h2 className="font-headline text-[17px] font-bold text-[#2563EB] md:text-lg">术语解释</h2>
              </div>
              <GlossaryGrid rows={glossaryRows} />
            </section>
          ) : null}

          <Link
            to="/archive"
            className="inline-block text-[13px] font-normal text-[#64748B] underline-offset-4 hover:text-[#2563EB] hover:underline"
          >
            ← 历史归档
          </Link>
        </div>
      </div>
    </div>
  );
}
