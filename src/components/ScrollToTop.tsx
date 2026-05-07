import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** 路由切换后将视口滚回顶部，避免从长页（如首页）跳转后仍停在页尾 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
