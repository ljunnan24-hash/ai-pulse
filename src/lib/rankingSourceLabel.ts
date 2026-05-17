import { labelSourceType } from './sourceCoverage';

function hostFromUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  try {
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 榜单事件列：标题上方「来源」文案 */
export function rankingSourceLabel(item: {
  primary_source_name?: string;
  source_type?: string;
  url?: string;
}): string | undefined {
  const named = (item.primary_source_name ?? '').trim();
  if (named) return named;
  const host = hostFromUrl(item.url ?? '');
  if (host) return host;
  const st = (item.source_type ?? '').trim();
  if (st) return labelSourceType(st);
  return undefined;
}
