import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Location } from 'react-router-dom';
import { useLocation, useNavigationType } from 'react-router-dom';

/** 各 history 条目对应的滚动位置（key 来自 React Router location.key） */
const scrollPositions = new Map<string, number>();
const pathScrollPositions = new Map<string, number>();
const SCROLL_STORAGE_PREFIX = 'ai-pulse:scroll:';

type RestoreLocationState = {
  restoreScroll?: boolean;
  restoreScrollY?: number;
};

export function scrollPathForLocation(location: Pick<Location, 'pathname' | 'search'>): string {
  return `${location.pathname}${location.search}`;
}

function searchWithoutEvent(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('event');
  return params.toString();
}

function isEventOverlayChange(prev: Pick<Location, 'pathname' | 'search'>, next: Pick<Location, 'pathname' | 'search'>): boolean {
  if (prev.pathname !== next.pathname) return false;
  if (prev.search === next.search) return false;
  return searchWithoutEvent(prev.search) === searchWithoutEvent(next.search);
}

export function getScrollPosition(key: string): number | undefined {
  return scrollPositions.get(key);
}

export function setScrollPosition(key: string, y: number): void {
  scrollPositions.set(key, y);
}

export function getPathScrollPosition(path: string): number | undefined {
  const cached = pathScrollPositions.get(path);
  if (cached !== undefined) return cached;

  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem(`${SCROLL_STORAGE_PREFIX}${path}`);
  if (raw === null) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function setPathScrollPosition(path: string, y: number): void {
  pathScrollPositions.set(path, y);

  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(`${SCROLL_STORAGE_PREFIX}${path}`, String(y));
  } catch {
    // sessionStorage may be unavailable in private / restricted contexts.
  }
}

export function clearScrollPositions(): void {
  scrollPositions.clear();
  pathScrollPositions.clear();
}

/** 异步内容加载后页面高度可能变高，多次尝试以恢复到目标位置 */
export function restoreScrollPosition(y: number, maxAttempts = 120): void {
  let attempts = 0;
  const tryRestore = () => {
    window.scrollTo(0, y);
    attempts += 1;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (y <= maxScroll + 2 || attempts >= maxAttempts) return;
    window.setTimeout(tryRestore, 50);
  };
  tryRestore();
}

function getRestoreState(state: unknown): RestoreLocationState {
  if (!state || typeof state !== 'object') return {};
  const s = state as Record<string, unknown>;
  return {
    restoreScroll: s.restoreScroll === true,
    restoreScrollY: typeof s.restoreScrollY === 'number' && Number.isFinite(s.restoreScrollY) ? s.restoreScrollY : undefined,
  };
}

function savedScrollForLocation(location: Location): number | undefined {
  return getScrollPosition(location.key) ?? getPathScrollPosition(scrollPathForLocation(location));
}

/**
 * 路由切换时：前进到新页滚到顶部；后退/前进（POP）恢复离开前的滚动位置。
 * 配合详情页 `navigate(-1)` 返回，避免从榜单进详情再返回时被拉到页顶。
 */
export function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentKeyRef = useRef(location.key);
  const currentPathRef = useRef(scrollPathForLocation(location));
  const prevLocationRef = useRef(location);

  useEffect(() => {
    const saveCurrentPosition = () => {
      const y = window.scrollY;
      setScrollPosition(currentKeyRef.current, y);
      setPathScrollPosition(currentPathRef.current, y);
    };

    window.addEventListener('scroll', saveCurrentPosition, { passive: true });
    window.addEventListener('click', saveCurrentPosition, true);
    window.addEventListener('keydown', saveCurrentPosition, true);
    window.addEventListener('pagehide', saveCurrentPosition);

    return () => {
      saveCurrentPosition();
      window.removeEventListener('scroll', saveCurrentPosition);
      window.removeEventListener('click', saveCurrentPosition, true);
      window.removeEventListener('keydown', saveCurrentPosition, true);
      window.removeEventListener('pagehide', saveCurrentPosition);
    };
  }, []);

  useLayoutEffect(() => {
    const prevLocation = prevLocationRef.current;
    currentKeyRef.current = location.key;
    currentPathRef.current = scrollPathForLocation(location);
    prevLocationRef.current = location;

    if (isEventOverlayChange(prevLocation, location)) return;

    if (location.hash) return;

    const restoreState = getRestoreState(location.state);

    if (navigationType === 'POP' || restoreState.restoreScroll) {
      const saved = restoreState.restoreScrollY ?? savedScrollForLocation(location);
      if (saved !== undefined) {
        restoreScrollPosition(saved);
        return;
      }
    }

    window.scrollTo(0, 0);
  }, [location.hash, location.key, location.state, navigationType]);

  return null;
}