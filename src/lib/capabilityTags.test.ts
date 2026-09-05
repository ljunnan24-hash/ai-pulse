import { describe, expect, it } from 'vitest';

import { allCapabilityTagsZero, CAPABILITY_DIMENSIONS } from './capabilityTags';

describe('capability tags', () => {
  it('keeps the six dimensions unique and in the expected order', () => {
    const keys = CAPABILITY_DIMENSIONS.map((item) => item.key);
    expect(keys).toEqual(['reasoning', 'coding', 'multimodal', 'long_context', 'realtime', 'safety']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('treats missing and all-zero values as non-displayable', () => {
    expect(allCapabilityTagsZero(undefined)).toBe(true);
    expect(allCapabilityTagsZero({ reasoning: 0, coding: 0 })).toBe(true);
    expect(allCapabilityTagsZero({ reasoning: 0.7 })).toBe(false);
  });
});
