import type { HomeRankingItem } from './homeRankingsDisplay';
import type { IndustryTagItem } from '../api/public';
import type { WeeklyLooseRow } from '../components/weekly/weeklyPayloadUtils';
import {
  pulseEventTitleEn,
  pulseEventTitleZh,
  pulseWhatHappened,
} from './homeRankingsDisplay';
import { rankingSourceLabel } from './rankingSourceLabel';
import type { PulseRankingsTableRow } from '../components/pulse/PulseRankingsTableLayout';
import { weeklyTopThreeDisplayScore } from '../components/weekly/weeklyPayloadUtils';

export type WeeklyTopThreeEventPatch = {
  category?: string;
  title?: string;
  title_zh?: string;
  url?: string;
  primary_source_name?: string;
  what_it_means_for_you?: string;
  what_happened?: string;
  industry_tags?: IndustryTagItem[];
};

/** 将周报 Top3 行 + 可选详情 API 补齐为与日榜一致的 RankingItem 形态 */
export function weeklyTopThreeAsRankingItem(
  row: WeeklyLooseRow,
  eid: number,
  api?: WeeklyTopThreeEventPatch,
): HomeRankingItem {
  const r = row as Record<string, string>;
  const canon = (api?.title ?? r.title ?? '').trim();
  const zh = (api?.title_zh ?? r.title_zh ?? '').trim();
  return {
    id: eid,
    title: canon,
    title_zh: zh,
    url: (r.url ?? api?.url ?? '').trim(),
    category: (api?.category ?? r.category ?? '').trim(),
    source_type: '',
    primary_source_name: (r.primary_source_name ?? r.source_name ?? api?.primary_source_name ?? '').trim(),
    source_count: 0,
    published_at: null,
    ranking_score: 0,
    score_delta: 0,
    what_happened: (r.what_happened ?? api?.what_happened ?? '').trim(),
    what_it_means_for_you: (r.what_it_means_for_you ?? api?.what_it_means_for_you ?? '').trim(),
    action_suggestion: '',
    industry_tags: api?.industry_tags,
  };
}

export function weeklyTopThreeToPulseTableRow(
  row: WeeklyLooseRow,
  rank: number,
  eid: number,
  api?: WeeklyTopThreeEventPatch,
  detailTo?: string,
): PulseRankingsTableRow {
  const item = weeklyTopThreeAsRankingItem(row, eid, api);
  return {
    key: `weekly-top3-${eid}-${rank}`,
    rank,
    score: weeklyTopThreeDisplayScore(row),
    titleZh: pulseEventTitleZh(item),
    titleEn: pulseEventTitleEn(item),
    sourceLabel: rankingSourceLabel(item),
    meaning: pulseWhatHappened(item),
    categorySlug: item.category || 'application',
    detailTo,
    industryTags: item.industry_tags?.slice(0, 2),
  };
}
