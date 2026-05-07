/**
 * 周报 Top3 分类：weeklyCategoryResolved 与 resolveWeeklyTopThreeCategory。
 */
import { describe, expect, it } from 'vitest';

import {
  resolveWeeklyNumericEventId,
  resolveWeeklyTopThreeCategory,
} from '@/src/components/weekly/WeeklyTopThreeList';
import {
  enrichWeeklyTopThreeWithLegacyTop3,
  pickWeeklyCategoryRaw,
  type WeeklyLooseRow,
} from '@/src/components/weekly/weeklyPayloadUtils';
import { resolveWeeklyCategoryDisplay } from '@/src/lib/weeklyCategoryDisplay';

describe('周报 Top3 category UI（weeklyCategoryResolved）', () => {
  it('Case 1：judgment 无 category，legacy 有 model_update → 解析为 slug model + 中文「模型」', () => {
    const rows: WeeklyLooseRow[] = [
      {
        title: '事件',
        url: '',
        what_happened: '',
        why_important: '',
        what_it_means_for_you: '',
        pulse_score: '',
        category: '',
        theme: '',
        event_id: '',
      },
    ];
    const legacy = [
      {
        title: '事件',
        url: 'https://a.com',
        what_happened: 'x',
        category: 'model_update',
      },
    ];
    const out = enrichWeeklyTopThreeWithLegacyTop3(rows, legacy);
    expect(resolveWeeklyTopThreeCategory(out[0])).toEqual({ slug: 'model', label: '模型' });
  });

  it('Case 2：judgment / legacy 都无 category，event_id 非数字 → weeklyCategoryResolved 为 null（UI 显示「未分类」）', () => {
    const row: WeeklyLooseRow = {
      title: 'X',
      url: '',
      what_happened: '',
      why_important: '',
      what_it_means_for_you: '',
      pulse_score: '',
      category: '',
      theme: '',
      event_id: 'e01',
      related_event_ids: 'e02,e01',
    };
    expect(resolveWeeklyNumericEventId(row)).toBeNull();
    expect(resolveWeeklyTopThreeCategory(row)).toBeNull();
  });

  it('Case 3：tool_product → 中文「工具/产品」，slug 为 tool_product（非原始 slug 裸显示）', () => {
    expect(resolveWeeklyCategoryDisplay('tool_product')).toEqual({
      slug: 'tool_product',
      label: '工具/产品',
    });
    const row: WeeklyLooseRow = {
      title: 'T',
      url: '',
      what_happened: '',
      why_important: '',
      what_it_means_for_you: '',
      pulse_score: '',
      category: 'tool_product',
      theme: '',
      event_id: '',
    };
    expect(resolveWeeklyTopThreeCategory(row)).toEqual({
      slug: 'tool_product',
      label: '工具/产品',
    });
  });

  it('Case 4：industry → 中文「行业」', () => {
    expect(resolveWeeklyCategoryDisplay('industry')).toEqual({ slug: 'industry', label: '行业' });
    const row: WeeklyLooseRow = {
      title: 'T',
      url: '',
      what_happened: '',
      why_important: '',
      what_it_means_for_you: '',
      pulse_score: '',
      category: 'industry',
      theme: '',
      event_id: '',
    };
    expect(resolveWeeklyTopThreeCategory(row)).toEqual({ slug: 'industry', label: '行业' });
  });

  it('详情 API 补 category：行无分类但传入 apiCategory 仍可解析', () => {
    const row: WeeklyLooseRow = {
      title: 'T',
      url: '',
      what_happened: '',
      why_important: '',
      what_it_means_for_you: '',
      pulse_score: '',
      category: '',
      theme: '',
      event_id: '12045',
    };
    expect(pickWeeklyCategoryRaw(row)).toBe('');
    expect(resolveWeeklyTopThreeCategory(row, 'model_update')).toEqual({ slug: 'model', label: '模型' });
  });
});
