import { describe, expect, it, vi } from 'vitest';

import { normalizeWeeklyRow, weeklyPulseTitleZh } from '@/src/components/weekly/weeklyPayloadUtils';
import { mergeWeeklyClusterItems, pickMergedWeeklyTopThree } from '@/src/lib/weeklyTopThreeDedupe';

describe('weekly Top3 簇内合并与去重', () => {
  it('三条 GPT-5.5 同簇 + 两条独立主题 → 合并为 1 条中文事件 +2，主标题为中文', () => {
    const raws = [
      { title: 'GPT-5.5 Instant: smarter, clearer, and more personalized', url: 'https://openai.com/a1', event_id: '101' },
      {
        title: 'OpenAI releases GPT-5.5 Instant, a new default model for ChatGPT',
        url: 'https://openai.com/a2',
        event_id: '102',
      },
      {
        title: 'OpenAI claims ChatGPT’s new default model hallucinates way less',
        title_zh: 'OpenAI 将 GPT-5.5 Instant 设为 ChatGPT 默认模型',
        what_happened: 'OpenAI 将 GPT-5.5 Instant 设为 ChatGPT 默认模型，模型个性化与幻觉控制能力提升。',
        url: 'https://openai.com/a3',
        event_id: '103',
        source_urls: ['https://news.example/src-main'],
      },
      {
        title: 'AWS Bedrock Agent update',
        title_zh: 'AWS Bedrock 发布企业级 Agent 工具链更新',
        url: 'https://aws.example/b',
        event_id: '201',
      },
      {
        title: 'EU AI Act compliance news',
        title_zh: '欧盟 AI 合规监管与模型版权规则新变化',
        url: 'https://eu.example/c',
        event_id: '301',
      },
    ];

    const normalized = raws.map((x) => normalizeWeeklyRow(x)).filter(Boolean) as NonNullable<
      ReturnType<typeof normalizeWeeklyRow>
    >[];

    expect(normalized).toHaveLength(5);

    const picked = pickMergedWeeklyTopThree(normalized);
    expect(picked).toHaveLength(3);

    const zhLine = weeklyPulseTitleZh(picked[0]);
    expect(zhLine).toContain('OpenAI');
    expect(zhLine).toContain('GPT-5.5');
    expect(/[\u4e00-\u9fff]/.test(zhLine)).toBe(true);
    expect(zhLine).not.toMatch(/^GPT-5\.5 Instant: smarter/i);

    expect(picked[0].source_urls).toContain('https://openai.com/a1');
    expect(picked[0].source_urls).toContain('https://news.example/src-main');
    expect(picked[0].related_event_ids?.split(',').filter(Boolean).length).toBeGreaterThanOrEqual(3);

    expect(weeklyPulseTitleZh(picked[1])).toContain('AWS');
    expect(weeklyPulseTitleZh(picked[2])).toContain('欧盟');
  });

  it('两稿同簇合并后只占一条，不重复补位', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const normalized = [
      normalizeWeeklyRow({
        title: 'GPT-5.5 Instant: marketing line',
        url: 'https://openai.com/x1',
        event_id: '101',
      })!,
      normalizeWeeklyRow({
        title: 'OpenAI releases GPT-5.5 Instant for ChatGPT',
        url: 'https://openai.com/x2',
        event_id: '102',
      })!,
    ];
    const picked = pickMergedWeeklyTopThree(normalized);
    expect(picked).toHaveLength(1);
    warn.mockRestore();
  });

  it('mergeWeeklyClusterItems 合并来源 URL 去重', () => {
    const a = normalizeWeeklyRow({
      title: 'A',
      url: 'https://same/path/',
      event_id: '1',
    })!;
    const b = normalizeWeeklyRow({
      title: 'B',
      url: 'https://same/path/',
      event_id: '2',
      source_urls: ['https://other.example/o'],
    })!;
    const m = mergeWeeklyClusterItems(a, b);
    const lines = (m.source_urls ?? '').split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
  });
});
