import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** 各 history 条目对应的滚动位置（key 来自 React Router location.key） */
const scrollPositions = new Map<string, number>();

export function getScrollPosition(key: string): number | undefined {
  return scrollPositions.get(key);
}

export function setScrollPosition(key: string, y: number): void {
  scrollPositions.set(key, y);
}

/** 异步内容加载后页面高度可能变高，多次尝试以恢复到目标位置 */
export function restoreScrollPosition(y: number, maxAttempts = 12): void {
  let attempts = 0;
  const tryRestore = () => {
    window.scrollTo(0, y);
    attempts += 1;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (y <= maxScroll + 2 || attempts >= maxAttempts) return;
    requestAnimationFrame(tryRestore);
  };
  requestAnimationFrame(tryRestore);
}

/**
 * 路由切换时：前进到新页滚到顶部；后退/前进（POP）恢复离开前的滚动位置。
 * 配合详情页 `navigate(-1)` 返回，避免从榜单进详情再返回时被拉到页顶。
 */
export function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    const prev = prevLocationRef.current;
    if (prev.key !== location.key) {
      setScrollPosition(prev.key, window.scrollY);
    }
    prevLocationRef.current = location;

    if (location.hash) return;

    if (navigationType === 'POP') {
      const saved = getScrollPosition(location.key);
      if (saved !== undefined) {
        restoreScrollPosition(saved);
        return;
      }
    }

    window.scrollTo(0, 0);
  }, [location, navigationType]);

  return null;
}
