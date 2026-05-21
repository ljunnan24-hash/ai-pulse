import { describe, expect, it } from 'vitest';

import type { EventDetailResponse } from '../api/public';
import {
  eventDetailPulseScore,
  pulseDisplayScore,
  pulseWhatHappened,
  rankingsDisplayScore,
} from './homeRankingsDisplay';

describe('pulseWhatHappened', () => {
  it('returns what_happened when present', () => {
    const item = { what_happened: 'OpenAI 在新加坡推出服务。' } as Parameters<typeof pulseWhatHappened>[0];
    expect(pulseWhatHappened(item)).toBe('OpenAI 在新加坡推出服务。');
  });

  it('falls back when what_happened empty', () => {
    const item = { what_happened: '' } as Parameters<typeof pulseWhatHappened>[0];
    expect(pulseWhatHappened(item)).toContain('暂无');
  });
});

describe('rankingsDisplayScore', () => {
  it('7d uses effective_ranking_score when present', () => {
    const item = {
      pulse_score: 90,
      effective_ranking_score: 55.2,
    } as Parameters<typeof rankingsDisplayScore>[0];
    expect(rankingsDisplayScore(item, '7d')).toBe(55.2);
    expect(rankingsDisplayScore(item, 'today')).toBe(90);
  });
});

describe('pulseDisplayScore', () => {
  it('prefers pulse_score over ranking_score when they diverge (Case 5)', () => {
    const item = {
      pulse_score: 90,
      ranking_score: 72,
    } as Parameters<typeof pulseDisplayScore>[0];
    expect(pulseDisplayScore(item)).toBe(90);
  });

  it('falls back to ranking_score when pulse_score absent', () => {
    const item = { ranking_score: 82.3 } as Parameters<typeof pulseDisplayScore>[0];
    expect(pulseDisplayScore(item)).toBe(82.3);
  });
});

describe('eventDetailPulseScore', () => {
  it('Case 2: prefers pulse_score when ranking_score differs', () => {
    const d = {
      pulse_score: 90,
      ranking_score: 70,
      stored_ranking_score: 70,
    } as unknown as EventDetailResponse;
    expect(eventDetailPulseScore(d)).toBe(90);
  });

  it('Case 3: falls back to ranking_score when no pulse_score', () => {
    const d = {
      ranking_score: 71.5,
    } as unknown as EventDetailResponse;
    expect(eventDetailPulseScore(d)).toBe(71.5);
  });

  it('Case 4: ignores stored_ranking_score for display', () => {
    const d = {
      pulse_score: 88,
      ranking_score: 88,
      stored_ranking_score: 55,
      effective_ranking_score: 60,
    } as unknown as EventDetailResponse;
    expect(eventDetailPulseScore(d)).toBe(88);
  });
});
