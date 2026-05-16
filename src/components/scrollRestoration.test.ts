import { describe, expect, it } from 'vitest';

import { getScrollPosition, setScrollPosition } from './ScrollToTop';

describe('scroll position cache', () => {
  it('stores and retrieves by location key', () => {
    setScrollPosition('rankings-key', 420);
    expect(getScrollPosition('rankings-key')).toBe(420);
    expect(getScrollPosition('missing')).toBeUndefined();
  });
});
