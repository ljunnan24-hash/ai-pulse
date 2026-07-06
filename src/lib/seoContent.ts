export function compactText(value: unknown, maxLen = 160): string {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

export function weeklySeoDescription(payload: Record<string, unknown> | null | undefined, fallbackTitle: string): string {
  const normal = ((payload?.normal as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const thesis = ((normal.weekly_thesis as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const summary = compactText(thesis.summary, 150);
  if (summary) return summary;

  const top3 = Array.isArray(normal.top3) ? normal.top3 : [];
  const titles = top3
    .map((item) => (typeof item === 'object' && item ? compactText((item as { title?: unknown }).title, 40) : ''))
    .filter(Boolean)
    .slice(0, 3);
  if (titles.length > 0) return `本期 AI Pulse 周报关注：${titles.join('、')}。`;
  return compactText(fallbackTitle || 'AI Pulse 中文周报，整理本周 AI 模型、工具、开源和行业动态。');
}

export function weeklySeoHeadline(payload: Record<string, unknown> | null | undefined, fallbackTitle: string): string {
  const normal = ((payload?.normal as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const thesis = ((normal.weekly_thesis as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  return compactText(thesis.headline, 80) || compactText(fallbackTitle, 80) || 'AI Pulse 周报';
}
