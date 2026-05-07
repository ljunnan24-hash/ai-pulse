import type { RankingItem } from './RankingCard';
import {
  pulseDisplayScore,
  pulseEventTitleEn,
  pulseEventTitleZh,
  pulseWhatItMeans,
} from '../../lib/homeRankingsDisplay';
import { PulseRankingsTableLayout, type PulseRankingsTableRow } from '../pulse/PulseRankingsTableLayout';

type Props = {
  items: RankingItem[];
};

/** 榜单页表格（与首页 Top5、周报 Top3 共用 {@link PulseRankingsTableLayout}） */
export function RankingsPageTable({ items }: Props) {
  if (items.length === 0) return null;

  const rows: PulseRankingsTableRow[] = items.map((item, idx) => ({
    key: String(item.id),
    rank: idx + 1,
    score: pulseDisplayScore(item),
    titleZh: pulseEventTitleZh(item),
    titleEn: pulseEventTitleEn(item),
    meaning: pulseWhatItMeans(item),
    categorySlug: item.category ?? '',
    detailTo: `/events/${item.id}`,
  }));

  return <PulseRankingsTableLayout rows={rows} />;
}
