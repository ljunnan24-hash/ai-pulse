/**
 * 周报 Top3 分类：把任意 category_slug / 中文标签映射为 pill slug + 展示文案。
 * 无可用字段时由 UI 层显示轻量「未分类」，不使用「—」。
 */

export type WeeklyCategoryResolved = { slug: string; label: string };

const EXACT_SLUG: Record<string, WeeklyCategoryResolved> = {
  model: { slug: 'model', label: '模型' },
  model_update: { slug: 'model', label: '模型' },
  tool: { slug: 'tool', label: '工具' },
  /** 与后端 GlobalEvent / Top3 slug 对齐；pill 仍走 categoryPillClass('tool_product') */
  tool_product: { slug: 'tool_product', label: '工具/产品' },
  application: { slug: 'product', label: '产品' },
  product: { slug: 'product', label: '产品' },
  enterprise: { slug: 'enterprise', label: '企业' },
  developer: { slug: 'developer', label: '开发' },
  dev: { slug: 'developer', label: '开发' },
  industry: { slug: 'industry', label: '行业' },
  policy: { slug: 'policy', label: '政策' },
  regulation: { slug: 'policy', label: '政策' },
  open_source: { slug: 'open_source', label: '开源' },
};

/**
 * 分类取值优先级（字段层面）在 {@link pickWeeklyCategoryRaw}；
 * 此处把「原始字符串」解析为 canonical slug + 中文 label。
 */
export function resolveWeeklyCategoryDisplay(rawInput: string): WeeklyCategoryResolved | null {
  const raw = (rawInput ?? '').trim();
  if (!raw) return null;

  const normKey = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (EXACT_SLUG[normKey]) return EXACT_SLUG[normKey];

  if (/模型/.test(raw) || /^model/i.test(raw)) return { slug: 'model', label: '模型' };
  if (/产品|应用/.test(raw) || /^(product|application)$/i.test(raw)) return { slug: 'product', label: '产品' };
  if (/企业/.test(raw) || /^enterprise$/i.test(raw)) return { slug: 'enterprise', label: '企业' };
  if (/开发/.test(raw) || /^dev(eloper)?$/i.test(raw)) return { slug: 'developer', label: '开发' };
  if (/工具/.test(raw) || /^tool$/i.test(raw)) return { slug: 'tool', label: '工具' };
  if (/行业/.test(raw) || /^industry$/i.test(raw)) return { slug: 'industry', label: '行业' };
  if (/政策|法规|监管/.test(raw) || /^(policy|regulation)$/i.test(raw)) return { slug: 'policy', label: '政策' };
  if (/开源/.test(raw) || /open[_\s-]*source/i.test(raw)) return { slug: 'open_source', label: '开源' };

  /** 无法识别的非空串：用中性 slug，原文缩短展示 */
  const label = raw.length > 10 ? `${raw.slice(0, 10)}…` : raw;
  return { slug: 'all', label };
}
