import type { RankingItem } from './RankingCard';
import {
  pulseEventTitleEn,
  pulseEventTitleZh,
  pulseWhatHappened,
  rankingsDisplayScore,
} from '../../lib/homeRankingsDisplay';
import { rankingSourceLabel } from '../../lib/rankingSourceLabel';
import { PulseRankingsTableLayout, type PulseRankingsTableRow } from '../pulse/PulseRankingsTableLayout';

type Props = {
  items: RankingItem[];
  /** today | 7d | 30d — 7d/30d 分数列与排序使用 effective_ranking_score */
  range: string;
  detailHrefForItem?: (item: RankingItem) => string;
};

/** 榜单页表格（与首页 Top5、周报 Top3 共用 {@link PulseRankingsTableLayout}） */
export function RankingsPageTable({ items, range, detailHrefForItem }: Props) {
  if (items.length === 0) return null;

  const scoreLabel = range === '7d' || range === '30d' ? '综合分' : 'Pulse Score';

  const rows: PulseRankingsTableRow[] = items.map((item, idx) => ({
    key: String(item.id),
    rank: idx + 1,
    score: rankingsDisplayScore(item, range),
    titleZh: pulseEventTitleZh(item),
    titleEn: pulseEventTitleEn(item),
    sourceLabel: rankingSourceLabel(item),
    meaning: pulseWhatHappened(item),
    categorySlug: item.category ?? '',
    detailTo: detailHrefForItem ? detailHrefForItem(item) : `/events/${item.id}`,
    industryTags: item.industry_tags?.slice(0, 2),
  }));

  return <PulseRankingsTableLayout rows={rows} scoreColumnLabel={scoreLabel} />;
}