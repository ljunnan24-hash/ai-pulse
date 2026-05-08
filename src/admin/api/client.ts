import { apiBase } from '../../config';
import { getAdminToken } from '../auth/adminToken';

export type AdminTokenOut = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
};

export type AdminMetrics = {
  total: number;
  active_confirmed: number;
  pending: number;
  unsubscribed: number;
  top_keywords: Array<{ keyword: string; active_confirmed_count: number }>;
};

export type AdminSubscriberRow = {
  id: number;
  email: string;
  status: 'active' | 'pending' | 'unsubscribed' | string;
  mode: 'simple' | 'normal' | string;
  keywords: string[];
  keywords_json: string;
  created_at: string;
  confirmed_at: string | null;
  last_sent_at: string | null;
  send_count: number;
};

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(init?.headers || undefined);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function adminLogin(username: string, password: string): Promise<AdminTokenOut> {
  return await http<AdminTokenOut>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function adminMe(): Promise<{ id: number; username: string }> {
  return await http<{ id: number; username: string }>('/admin/auth/me');
}

export async function adminMetrics(): Promise<AdminMetrics> {
  return await http<AdminMetrics>('/admin/metrics');
}

export async function adminSubscribers(params: {
  q?: string;
  status?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminSubscriberRow[]> {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const qs = usp.toString();
  return await http<AdminSubscriberRow[]>(`/admin/subscribers${qs ? `?${qs}` : ''}`);
}

export async function adminSubscriber(id: number): Promise<AdminSubscriberRow> {
  return await http<AdminSubscriberRow>(`/admin/subscribers/by-id/${id}`);
}

export function adminExportCsvUrl(params: { status?: string; keyword?: string }) {
  const usp = new URLSearchParams();
  if (params.status) usp.set('status', params.status);
  if (params.keyword) usp.set('keyword', params.keyword);
  const qs = usp.toString();
  return `${apiBase()}/admin/subscribers/export.csv${qs ? `?${qs}` : ''}`;
}

export async function adminUnsubscribe(id: number) {
  return await http<{ ok: boolean }>(`/admin/subscribers/by-id/${id}/unsubscribe`, { method: 'POST' });
}

export async function adminResendConfirmation(id: number) {
  return await http<{ ok: boolean }>(`/admin/subscribers/by-id/${id}/resend-confirmation`, { method: 'POST' });
}

export async function adminResendLatestWeekly(id: number) {
  return await http<{ ok: boolean }>(`/admin/subscribers/by-id/${id}/resend-latest-weekly`, { method: 'POST' });
}

export type AdminAnalyticsSummary = {
  timezone_note?: string;
  today: { pv: number; uv: number };
  last_7_days: { pv: number; uv: number };
  last_30_days: { pv: number; uv: number };
  top_pages: Array<{ path: string; pv: number; uv: number }>;
};

export async function adminAnalyticsSummary(): Promise<AdminAnalyticsSummary> {
  return await http<AdminAnalyticsSummary>('/api/admin/analytics/summary');
}

export type AdminPageviewRow = {
  id: number;
  visitor_id: string;
  session_id: string | null;
  path: string;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  created_at: string | null;
};

export async function adminAnalyticsPageviews(limit = 100): Promise<{ items: AdminPageviewRow[] }> {
  return await http<{ items: AdminPageviewRow[] }>(`/api/admin/analytics/pageviews?limit=${limit}`);
}

export type AdminFeedbackRow = {
  id: number;
  content: string;
  contact: string | null;
  source_page: string | null;
  status: string;
  admin_note: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  visitor_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function adminFeedbackList(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminFeedbackRow[]; total_returned: number }> {
  const usp = new URLSearchParams();
  if (params?.status) usp.set('status', params.status);
  if (params?.limit != null) usp.set('limit', String(params.limit));
  if (params?.offset != null) usp.set('offset', String(params.offset));
  const qs = usp.toString();
  return await http<{ items: AdminFeedbackRow[]; total_returned: number }>(
    `/api/admin/feedback${qs ? `?${qs}` : ''}`,
  );
}

export async function adminFeedbackPatch(
  id: number,
  body: { status?: string; admin_note?: string | null },
): Promise<{ id: number; status: string; admin_note: string | null; updated_at: string | null }> {
  return await http(`/api/admin/feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

