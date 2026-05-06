/**
 * 榜单条目类型与辅助函数；页面列表请以信息卡片 / `RankingsInformationList` 等组件为准。
 * 本模块保留 `RankingItem` 类型与 `buildDisplayJudgment`，供表格与详情等复用。
 */
import type { RankingsResponse } from '../../api/public';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

export type RankingItem = RankingsResponse['items'][number];
/** 判断优先：one_liner → why_important → means → happened → title（标题兜底弱化排版） */
export function buildDisplayJudgment(item: RankingItem): {
  text: string;
  fromOneLiner: boolean;
  isTitleFallback: boolean;
} {
  const one = (item.one_liner ?? '').trim();
  if (one) return { text: one, fromOneLiner: true, isTitleFallback: false };
  const why = (item.why_important ?? '').trim();
  if (why) return { text: why, fromOneLiner: false, isTitleFallback: false };
  const means = (item.what_it_means_for_you ?? '').trim();
  if (means) return { text: means, fromOneLiner: false, isTitleFallback: false };
  const happened = (item.what_happened ?? '').trim();
  if (happened) return { text: happened, fromOneLiner: false, isTitleFallback: false };
  const { primary } = splitTitleForDisplay(item.title);
  if (primary.trim()) return { text: primary.trim(), fromOneLiner: false, isTitleFallback: true };
  return { text: (item.title || '').trim() || '—', fromOneLiner: false, isTitleFallback: true };
}
