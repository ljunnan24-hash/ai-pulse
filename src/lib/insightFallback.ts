/** 榜单 / 首页 insight 字段展示用的中文 fallback（Phase 2.5） */

export function displayEventTitle(title: string | undefined | null): string {
  const t = (title ?? '').trim();
  return t || '未命名 AI 事件';
}

export function displayInsightSummary(what_it_means_for_you: string, what_happened: string): string {
  const m = (what_it_means_for_you ?? '').trim();
  if (m) return m;
  const h = (what_happened ?? '').trim();
  if (h) return h;
  return '该事件仍在分析中，稍后补充判断。';
}

export function displayActionSuggestion(action_suggestion: string | undefined | null): string {
  const a = (action_suggestion ?? '').trim();
  return a || '先观望';
}
