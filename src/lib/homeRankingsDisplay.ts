import type { RankingsResponse } from '../api/public';

import { firstSentences } from './insightFallback';
import { deriveEventPageHeading, splitTitleForDisplay } from './titleDisplay';

export type HomeRankingItem = RankingsResponse['items'][number];

function looseStr(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

/**
 * 榜单事件中文标题：优先客观字段（title_zh / title / what_happened 锚点），弱化「总结型」one_liner。
 * 兼容接口将来扩展字段。
 */
export function pulseEventTitleZh(item: HomeRankingItem): string {
  const o = item as unknown as Record<string, unknown>;
  for (const k of ['title_zh', 'zh_title', 'headline_zh', 'summary_title']) {
    const s = looseStr(o, k);
    if (s) return s;
  }
  const { primary } = deriveEventPageHeading(item.title, item.what_happened);
  if (primary.trim()) return primary.trim();
  const nt = (item.normalized_title ?? '').trim();
  if (nt) return nt;
  const wh = (item.what_happened ?? '').trim();
  if (wh) return firstSentences(wh, 1, 220) || wh.slice(0, 220);
  return chineseIntroHeadline(item);
}

/** 英文 / 原文标题行；无则不应占位 */
export function pulseEventTitleEn(item: HomeRankingItem): string | undefined {
  const o = item as unknown as Record<string, unknown>;
  for (const k of ['title_en', 'source_title', 'original_title', 'raw_title']) {
    const s = looseStr(o, k);
    if (s) return s;
  }
  const split = splitTitleForDisplay(item.title);
  if (split.secondary) return split.secondary;
  const raw = (item.title ?? '').trim();
  if (raw && !/[\u4e00-\u9fff]/.test(raw)) return raw;
  return undefined;
}

export function formatSlashDateFromIso(iso: string): string {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return iso.replace(/T.*/, '').replaceAll('-', ' / ');
  return `${y} / ${m} / ${day}`;
}

export function focusCardDate(item: HomeRankingItem | undefined, rankUpdatedAt: string | null): string {
  if (item?.published_at) return formatSlashDateFromIso(item.published_at);
  if (rankUpdatedAt) return formatSlashDateFromIso(rankUpdatedAt);
  return formatSlashDateFromIso(new Date().toISOString());
}

/** 主标题：中文简介 / one_liner → why 短句 → what_happened 短句 → title */
export function chineseIntroHeadline(item: HomeRankingItem): string {
  const one = (item.one_liner ?? '').trim();
  if (one) return one;
  const why = (item.why_important ?? '').trim();
  if (why) return firstSentences(why, 1, 220) || why.slice(0, 220);
  const wh = (item.what_happened ?? '').trim();
  if (wh) return firstSentences(wh, 1, 220) || wh.slice(0, 220);
  return (item.title ?? '').trim() || '—';
}

/** 副标题：原始标题锚点 */
export function originalTitleLine(item: HomeRankingItem): string {
  const t = (item.title ?? '').trim();
  if (t) return t;
  const n = (item.normalized_title ?? '').trim();
  if (n) return n;
  return chineseIntroHeadline(item);
}

export function whatItMeansCell(item: HomeRankingItem): string {
  const m = (item.what_it_means_for_you ?? '').trim();
  if (m) return m;
  const a = (item.action_suggestion ?? '').trim();
  if (a) return a;
  return '暂无明确用户影响，可查看详情了解来源信息';
}

/** 「对你意味着什么」：按价值字段优先级，最后再用 action 建议等兜底 */
export function pulseWhatItMeans(item: HomeRankingItem): string {
  const o = item as unknown as Record<string, unknown>;
  for (const k of [
    'user_value',
    'meaning_for_user',
    'what_it_means',
    'why_it_matters_to_you',
    'what_it_means_for_you',
  ]) {
    const s = looseStr(o, k);
    if (s) return s;
  }
  const summary = looseStr(o, 'summary');
  if (summary) return summary;
  return whatItMeansCell(item);
}

export function gradeLabel(score: number): string {
  if (score >= 90) return '很高';
  if (score >= 80) return '较高';
  if (score >= 70) return '中等';
  return '一般';
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/** 0–1 视为小数，否则按 0–100 */
function normalizeScore100(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  let v = raw;
  if (v >= 0 && v <= 1) v *= 100;
  return Math.round(Math.min(100, Math.max(0, v)));
}

function readScoreBreakdown(item: HomeRankingItem): Record<string, number> | null {
  const direct = item.score_breakdown;
  if (direct && typeof direct === 'object') return direct as Record<string, number>;
  const mj = item.metrics_json;
  if (!mj || typeof mj !== 'object') return null;
  const inner = (mj as Record<string, unknown>).score_breakdown;
  if (!inner || typeof inner !== 'object') return null;
  return inner as Record<string, number>;
}

function estimateFreshnessFromPublished(publishedAt: string | null): number {
  if (!publishedAt) return 80;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 80;
  const hours = (Date.now() - t) / (1000 * 60 * 60);
  if (hours <= 24) return 95;
  if (hours <= 72) return 88;
  if (hours <= 168) return 78;
  if (hours <= 720) return 68;
  return 60;
}

export function computeThreeMetrics(item: HomeRankingItem): {
  freshness: number;
  heat: number;
  userValue: number;
} {
  const sb = readScoreBreakdown(item);

  let freshness =
    toFiniteNumber(sb?.freshness) ??
    toFiniteNumber((item as { freshness_score?: unknown }).freshness_score);
  if (freshness === null) freshness = estimateFreshnessFromPublished(item.published_at);
  freshness = normalizeScore100(freshness);

  let heat =
    toFiniteNumber(sb?.hotness) ??
    toFiniteNumber(sb?.popularity) ??
    toFiniteNumber(sb?.heat) ??
    toFiniteNumber((item as { hotness_score?: unknown }).hotness_score) ??
    toFiniteNumber((item as { popularity_score?: unknown }).popularity_score);
  if (heat === null) {
    const base = item.ranking_score;
    heat = typeof base === 'number' && Number.isFinite(base) ? base * 0.9 : 75;
  }
  heat = normalizeScore100(heat);

  let userValue =
    toFiniteNumber(sb?.user_value) ?? toFiniteNumber((item as { user_value_score?: unknown }).user_value_score);
  if (userValue === null) {
    const pulse = toFiniteNumber(item.pulse_score) ?? toFiniteNumber(item.score);
    if (pulse !== null) userValue = pulse;
    else {
      const rs = item.ranking_score;
      userValue = typeof rs === 'number' && Number.isFinite(rs) ? rs : 80;
    }
  }
  userValue = normalizeScore100(userValue);

  return { freshness, heat, userValue };
}

/** 展示用 Pulse 数值：与榜单一致的排序分优先 */
export function pulseDisplayScore(item: HomeRankingItem): number {
  const p = toFiniteNumber(item.pulse_score) ?? toFiniteNumber(item.score);
  if (p !== null) {
    const v = p >= 0 && p <= 1 ? p * 100 : p;
    return Math.round(v * 10) / 10;
  }
  const rs = item.ranking_score;
  return typeof rs === 'number' && Number.isFinite(rs) ? Math.round(rs * 10) / 10 : 0;
}
