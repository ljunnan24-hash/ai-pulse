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
  return await http<AdminSubscriberRow>(`/admin/subscribers/${id}`);
}

export function adminExportCsvUrl(params: { status?: string; keyword?: string }) {
  const usp = new URLSearchParams();
  if (params.status) usp.set('status', params.status);
  if (params.keyword) usp.set('keyword', params.keyword);
  const qs = usp.toString();
  return `${apiBase()}/admin/subscribers/export.csv${qs ? `?${qs}` : ''}`;
}

export async function adminUnsubscribe(id: number) {
  return await http<{ ok: boolean }>(`/admin/subscribers/${id}/unsubscribe`, { method: 'POST' });
}

export async function adminResendConfirmation(id: number) {
  return await http<{ ok: boolean }>(`/admin/subscribers/${id}/resend-confirmation`, { method: 'POST' });
}

export async function adminResendLatestWeekly(id: number) {
  return await http<{ ok: boolean }>(`/admin/subscribers/${id}/resend-latest-weekly`, { method: 'POST' });
}

