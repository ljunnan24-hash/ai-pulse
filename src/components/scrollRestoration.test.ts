import { beforeEach, describe, expect, it } from 'vitest';

import { clearScrollPositions, getScrollPosition, setScrollPosition } from './ScrollToTop';

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
    clearScrollPositions();
    expect(getScrollPosition('rankings-key')).toBeUndefined();
  });
});