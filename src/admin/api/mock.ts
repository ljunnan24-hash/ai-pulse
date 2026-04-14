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
  status: 'active' | 'pending' | 'unsubscribed';
  mode: 'simple' | 'normal';
  keywords: string[];
  created_at: string;
  confirmed_at: string | null;
  last_sent_at: string | null;
  send_count: number;
};

export const mockMetrics: AdminMetrics = {
  total: 7,
  active_confirmed: 2,
  pending: 5,
  unsubscribed: 0,
  top_keywords: [
    { keyword: 'ai', active_confirmed_count: 2 },
    { keyword: 'agent', active_confirmed_count: 2 },
    { keyword: 'model', active_confirmed_count: 2 },
  ],
};

export const mockSubscribers: AdminSubscriberRow[] = [
  {
    id: 1,
    email: 'ljunnan23@gmail.com',
    status: 'active',
    mode: 'normal',
    keywords: ['ai', 'agent', 'model'],
    created_at: '2026-04-08 20:00:48',
    confirmed_at: '2026-04-08 14:00:48',
    last_sent_at: '2026-04-08 14:01:21',
    send_count: 1,
  },
  {
    id: 2,
    email: 'test-1775567445@qq.com',
    status: 'active',
    mode: 'normal',
    keywords: ['ai', 'agent', 'model'],
    created_at: '2026-04-07 21:10:45',
    confirmed_at: '2026-04-08 09:51:21',
    last_sent_at: '2026-04-08 09:51:30',
    send_count: 1,
  },
  {
    id: 3,
    email: 'ljunnan23+100@gmail.com',
    status: 'pending',
    mode: 'normal',
    keywords: ['ai', 'agent', 'model'],
    created_at: '2026-04-13 22:36:20',
    confirmed_at: null,
    last_sent_at: null,
    send_count: 0,
  },
];

