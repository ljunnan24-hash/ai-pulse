import { apiBase } from '../config';

/** 不纳入公开访问统计的路径（后台、健康检查、静态资源等） */
const SKIP_PATH_PREFIXES = ['/admin', '/manage'];
const SKIP_PATH_EXACT = new Set(['/health', '/login', '/api/health']);

export function shouldRecordAnalyticsPath(pathnameWithSearch: string): boolean {
  const pathname = pathnameWithSearch.split('?')[0] || '';
  if (SKIP_PATH_EXACT.has(pathname)) return false;
  for (const prefix of SKIP_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return false;
  }
  if (/\.(ico|png|jpe?g|gif|webp|svg|css|js|mjs|map|woff2?|ttf|eot|json)$/i.test(pathname)) {
    return false;
  }
  return true;
}

const VID_KEY = 'aipulse_vid';
const SID_KEY = 'aipulse_sid';

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 匿名访客 ID（localStorage） */
export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v || v.length < 8) {
      v = randomId();
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    return randomId();
  }
}

/** 单次会话 ID（sessionStorage） */
export function getSessionId(): string {
  try {
    let s = sessionStorage.getItem(SID_KEY);
    if (!s) {
      s = randomId();
      sessionStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch {
    return randomId();
  }
}

/** 上报页面浏览；失败静默忽略 */
export async function sendPageview(path: string, referrer?: string): Promise<void> {
  if (!shouldRecordAnalyticsPath(path)) return;

  const base = apiBase();
  const payload = {
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    path,
    referrer: referrer || undefined,
  };
  try {
    await fetch(`${base}/api/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}
