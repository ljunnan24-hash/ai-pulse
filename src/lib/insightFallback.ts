/** 榜单 / 首页 insight 字段展示用的中文 fallback（Phase 2.5） */

export function displayEventTitle(title: string | undefined | null): string {
  const t = (title ?? '').trim();
  return t || '未命名 AI 事件';
}

/** 取正文前若干句，用于列表摘要（信息优先） */
export function firstSentences(
  text: string | undefined | null,
  maxSentences = 2,
  maxChars = 320,
): string {
  const raw = (text ?? '').trim();
  if (!raw) return '';
  const parts = raw
    .split(/(?<=[。！？!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const chunk = parts.length
    ? parts.slice(0, maxSentences).join('')
    : raw.slice(0, maxChars);
  const s = chunk.length > maxChars ? chunk.slice(0, maxChars).trim() : chunk;
  return s;
}

/** 「为什么值得看」：仅用行业层 why_important（不把 one_liner 当作「事实」或主标题的补充混在这里） */
export function briefWhyWorth(item: { why_important?: string }): string {
  const w = (item.why_important ?? '').trim();
  if (w) return firstSentences(w, 2, 260);
  return '';
}

/** 「对你意味着什么」短摘 */
export function briefWhatMeans(what_it_means_for_you: string | undefined): string {
  return firstSentences(what_it_means_for_you, 2, 260);
}

export function displayInsightSummary(what_it_means_for_you: string, what_happened: string): string {
  const m = (what_it_means_for_you ?? '').trim();
  if (m) return m;
  const h = (what_happened ?? '').trim();
  if (h) return h;
  return '该事件仍在补充整理中，可先阅读标题与来源。';
}

export function displayActionSuggestion(action_suggestion: string | undefined | null): string {
  const a = (action_suggestion ?? '').trim();
  return a || '先观望';
}
