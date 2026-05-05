/** 来源类型 → 简短中文展示（用于「来源覆盖」辅文案） */

const SOURCE_TYPE_CN: Record<string, string> = {
  official: '官方',
  media: '媒体',
  github: 'GitHub',
  rss: 'RSS',
  community: '社区',
  social: '社交',
  meta: 'Meta',
  product: '产品',
  x: 'X',
};

export function labelSourceType(raw: string): string {
  const k = (raw || '').trim().toLowerCase();
  if (!k) return '来源';
  return SOURCE_TYPE_CN[k] ?? raw.trim();
}

/** 「官方 1 · 媒体 2」形式；无来源时返回 null */
export function formatSourceDistribution(
  sources: ReadonlyArray<{ source_type: string }>,
): string | null {
  if (!sources.length) return null;
  const counts = new Map<string, number>();
  for (const s of sources) {
    const t = (s.source_type || 'unknown').trim().toLowerCase() || 'unknown';
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => `${labelSourceType(t)} ${n}`);
  return parts.join(' · ');
}

export function hasScoreSourceMix(sb: Record<string, number>): boolean {
  if (!sb || typeof sb !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(sb, 'source_mix')) return false;
  const v = sb.source_mix;
  return typeof v === 'number' && !Number.isNaN(v);
}
