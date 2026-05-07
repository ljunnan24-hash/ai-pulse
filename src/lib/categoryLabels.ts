/** API category slug → 中文展示（与 GlobalEvent / 筛选 chip 对齐） */
export function categoryLabel(cat: string | undefined | null): string {
  const c = (cat || '').trim().toLowerCase();
  const map: Record<string, string> = {
    model: '模型',
    model_update: '模型',
    tool: '工具',
    tool_product: '工具/产品',
    industry: '行业',
    open_source: '开源',
    application: '应用',
    enterprise: '企业',
    policy: '政策',
    all: '全部',
  };
  return map[c] || cat || '—';
}
