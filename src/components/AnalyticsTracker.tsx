import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { sendPageview, shouldRecordAnalyticsPath } from '../lib/analytics';

/**
 * 路由变化时上报 PV（短时间去重同一 path）。
 * 挂载在 BrowserRouter 内。
 */
export function AnalyticsTracker() {
  const loc = useLocation();
  const guard = useRef<{ path: string; at: number }>({ path: '', at: 0 });

  useEffect(() => {
    const path = `${loc.pathname}${loc.search || ''}`;
    if (!shouldRecordAnalyticsPath(path)) return;

    const now = Date.now();
    const g = guard.current;
    if (path === g.path && now - g.at < 2000) return;
    g.path = path;
    g.at = now;

    const ref =
      typeof document !== 'undefined' && document.referrer && !document.referrer.startsWith(window.location.origin)
        ? document.referrer
        : undefined;

    void sendPageview(path, ref);
  }, [loc.pathname, loc.search]);

  return null;
}
