import {
  type HomeRankingItem,
  pulseDisplayScore,
  pulseEventTitleEn,
  pulseEventTitleZh,
  pulseWhatItMeans,
} from '../../lib/homeRankingsDisplay';
import { rankingSourceLabel } from '../../lib/rankingSourceLabel';
import { PulseRankingsTableLayout, type PulseRankingsTableRow } from '../pulse/PulseRankingsTableLayout';

type Props = {
  items: HomeRankingItem[];
};

/** 首页 Top5：与排行榜页同布局（{@link PulseRankingsTableLayout}） */
export function HomeTopFiveTable({ items }: Props) {
  if (items.length === 0) return null;

  const rows: PulseRankingsTableRow[] = items.map((item, idx) => ({
    key: String(item.id),
    rank: idx + 1,
    score: pulseDisplayScore(item),
    titleZh: pulseEventTitleZh(item),
    titleEn: pulseEventTitleEn(item),
    sourceLabel: rankingSourceLabel(item),
    meaning: pulseWhatItMeans(item),
    categorySlug: item.category ?? '',
    detailTo: `/events/${item.id}`,
    industryTags: item.industry_tags?.slice(0, 2),
  }));

  return <PulseRankingsTableLayout rows={rows} />;
}
