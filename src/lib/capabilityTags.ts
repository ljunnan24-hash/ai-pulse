/** 事件详情：capability_tags 六维顺序与中文标签（与后端 CAPABILITY_KEYS 对齐） */

export const CAPABILITY_DIMENSIONS = [
  { key: 'reasoning', label: '推理能力' },
  { key: 'coding', label: '代码能力' },
  { key: 'multimodal', label: '多模态' },
  { key: 'long_context', label: '长文本处理' },
  { key: 'realtime', label: '实时性' },
  { key: 'safety', label: '安全性' },
] as const;

export function allCapabilityTagsZero(tags: Record<string, number> | undefined): boolean {
  if (!tags || typeof tags !== 'object') return true;
  return CAPABILITY_DIMENSIONS.every((d) => (Number(tags[d.key]) || 0) === 0);
}
