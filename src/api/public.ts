import { apiBase } from '../config';

export type IndustryTagItem = { slug: string; label: string };

export type RankingsResponse = {
  range: string;
  category: string;
  /** 搜索关键词回显；未搜索时为 null */
  q?: string | null;
  updated_at: string;
  /** pulse_score | effective_ranking_score（7d/30d 为后者） */
  sort_by?: string;
  items: Array<{
    id: number;
    title: string;
    /** 后端豆包翻译或中文原标题；与 title（canonical）并存 */
    title_zh?: string;
    url: string;
    category: string;
    source_type: string;
    /** 主来源名称（RSS 源名 / 媒体名）；无则前端用域名或来源类型兜底 */
    primary_source_name?: string;
    source_count: number;
    published_at: string | null;
    /** 最近抓取 / 合并时间（ISO） */
    last_seen_at?: string | null;
    /** 稳定 Pulse Score（周期榜单主展示与排序依据） */
    pulse_score?: number;
    /** 与 pulse_score 对齐的兼容字段 */
    ranking_score: number;
    /** 存库综合分（含 freshness），调试用 */
    stored_ranking_score?: number;
    /** pulse_score × 时间衰减，调试用 / 未来实时流 */
    effective_ranking_score?: number;
    score_delta: number;
    what_happened: string;
    /** 列表接口若将来返回，可与下方字段区分展示标签 */
    why_important?: string;
    what_it_means_for_you: string;
    action_suggestion: string;
    /** 一句话判断（榜单卡片展示；缺失时前端兜底） */
    one_liner?: string;
    /** 若列表接口将来附带 metrics，可用于首页三指标 */
    metrics_json?: Record<string, unknown>;
    score_breakdown?: Record<string, number>;
    score?: number;
    freshness_score?: number;
    hotness_score?: number;
    popularity_score?: number;
    user_value_score?: number;
    normalized_title?: string;
    /** category=industry 时的细分标签 */
    industry_tags?: IndustryTagItem[];
  }>;
};

export type EventDetailResponse = {
  id: number;
  title: string;
  title_zh?: string;
  category: string;
  /** category=industry 时行业细分标签 */
  industry_tags?: IndustryTagItem[];
  published_at: string | null;
  /** 稳定 Pulse Score，主展示；与榜单 pulse_score 同源 */
  pulse_score?: number;
  /** 兼容字段，与 pulse_score 对齐 */
  ranking_score: number;
  /** 存库综合分（含 freshness），调试 */
  stored_ranking_score?: number;
  /** pulse × 时间衰减（详情默认按 7d 衰减），调试 */
  effective_ranking_score?: number;
  score?: number;
  /** 若后端将来下发，摘要区优先展示 */
  one_liner?: string;
  what_happened: string;
  why_important: string;
  what_it_means_for_you: string;
  action_suggestion: string;
  capability_tags: Record<string, number>;
  sources: Array<{
    source_name: string;
    source_type: string;
    url: string;
    published_at: string | null;
    raw_item_id: number;
  }>;
  score_breakdown: Record<string, number>;
  related_events: Array<{
    id: number;
    title: string;
    title_zh?: string;
    pulse_score?: number;
    ranking_score: number;
    stored_ranking_score?: number;
    category: string;
  }>;
};

export type WeeklyJsonResponse = {
  report_date: string;
  title: string;
  weekly_url: string;
  payload: Record<string, unknown>;
};

export type ArchiveResponse = {
  items: Array<{ report_date: string; title: string; weekly_url: string }>;
};

async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return (await res.json()) as T;
}

export function fetchRankings(params: { range: string; category: string; limit: number; q?: string }) {
  const sp = new URLSearchParams({
    range: params.range,
    category: params.category,
    limit: String(params.limit),
  });
  const qq = params.q?.trim();
  if (qq) {
    sp.set('q', qq);
  }
  return jget<RankingsResponse>(`/api/rankings?${sp.toString()}`);
}

export function fetchEventDetail(eventId: number) {
  return jget<EventDetailResponse>(`/api/events/${eventId}`);
}

export function fetchWeeklyLatest() {
  return jget<WeeklyJsonResponse>(`/api/weekly/latest`);
}

export function fetchWeeklyByDate(date: string) {
  return jget<WeeklyJsonResponse>(`/api/weekly/${encodeURIComponent(date)}`);
}

export function fetchArchive(limit = 52) {
  return jget<ArchiveResponse>(`/api/archive?limit=${limit}`);
}
