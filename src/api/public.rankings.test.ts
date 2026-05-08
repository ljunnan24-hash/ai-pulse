import { describe, expect, it } from 'vitest';

import { fetchRankings } from './public';

describe('fetchRankings q 参数', () => {
  it('带 q 时 URL 包含 q=', async () => {
    const orig = global.fetch;
    let seen = '';
    global.fetch = (async (input: RequestInfo) => {
      seen = String(input);
      return new Response(JSON.stringify({ range: '7d', category: 'all', items: [], updated_at: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      await fetchRankings({ range: '7d', category: 'all', limit: 50, q: '教育' });
      expect(seen).toContain('q=%E6%95%99%E8%82%B2');
    } finally {
      global.fetch = orig;
    }
  });

  it('无 q 时不带 q 参数', async () => {
    const orig = global.fetch;
    let seen = '';
    global.fetch = (async (input: RequestInfo) => {
      seen = String(input);
      return new Response(JSON.stringify({ range: 'today', category: 'all', items: [], updated_at: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      await fetchRankings({ range: 'today', category: 'all', limit: 20 });
      expect(seen).not.toContain('&q=');
      expect(seen).not.toContain('?q=');
    } finally {
      global.fetch = orig;
    }
  });
});
