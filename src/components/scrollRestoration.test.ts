import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearScrollPositions,
  getPathScrollPosition,
  getScrollPosition,
  scrollPathForLocation,
  setPathScrollPosition,
  setScrollPosition,
} from './ScrollToTop';

describe('scroll position cache', () => {
  beforeEach(() => {
    clearScrollPositions();
  });

  it('stores and retrieves by location key', () => {
    setScrollPosition('rankings-key', 420);
    expect(getScrollPosition('rankings-key')).toBe(420);
    expect(getScrollPosition('missing')).toBeUndefined();
  });

  it('can be cleared between navigation sessions', () => {
    setScrollPosition('rankings-key', 420);
    setPathScrollPosition('/rankings', 420);
    clearScrollPositions();
    expect(getScrollPosition('rankings-key')).toBeUndefined();
    expect(getPathScrollPosition('/rankings')).toBeUndefined();
  });

  it('stores and retrieves by path for non-POP restores', () => {
    setPathScrollPosition('/rankings?range=7d', 860);
    expect(getPathScrollPosition('/rankings?range=7d')).toBe(860);
  });

  it('builds a stable path key without hashes', () => {
    expect(scrollPathForLocation({ pathname: '/rankings', search: '?range=7d' })).toBe('/rankings?range=7d');
  });
});