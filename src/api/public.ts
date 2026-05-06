import { apiBase } from '../config';

export type RankingsResponse = {
  range: string;
  category: string;
  updated_at: string;
  items: Array<{
    id: number;
    title: string;
    url: string;
    category: string;
    source_type: string;
    source_count: number;
    published_at: string | null;
    ranking_score: number;
    score_delta: number;
    what_happened: string;
    /** 列表接口若将来返回，可与下方字段区分展示标签 */
    why_important?: string;
    what_it_means_for_you: string;
    action_suggestion: string;
    /** 一句话判断（榜单卡片展示；缺失时前端兜底） */
    one_liner?: string;
  }>;
};

export type EventDetailResponse = {
  id: number;
  title: string;
  category: string;
  published_at: string | null;
  ranking_score: number;
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
  related_events: Array<{ id: number; title: string; ranking_score: number; category: string }>;
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

export function fetchRankings(params: { range: string; category: string; limit: number }) {
  const sp = new URLSearchParams({
    range: params.range,
    category: params.category,
    limit: String(params.limit),
  });
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
