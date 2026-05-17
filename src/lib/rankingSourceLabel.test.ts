import { describe, expect, it } from 'vitest';

import { rankingSourceLabel } from './rankingSourceLabel';

describe('rankingSourceLabel', () => {
  it('prefers primary_source_name', () => {
    expect(
      rankingSourceLabel({
        primary_source_name: '机器之心',
        source_type: 'media',
        url: 'https://example.com/x',
      }),
    ).toBe('机器之心');
  });

  it('falls back to hostname then source type', () => {
    expect(rankingSourceLabel({ url: 'https://openai.com/blog/x', source_type: 'official' })).toBe(
      'openai.com',
    );
    expect(rankingSourceLabel({ source_type: 'github' })).toBe('GitHub');
  });
});
