/** API category slug → 中文展示 */
export function categoryLabel(cat: string | undefined | null): string {
  const c = (cat || '').trim().toLowerCase();
  const map: Record<string, string> = {
    model: '模型',
    tool: '工具',
    industry: '行业',
    open_source: '开源',
    application: '应用',
    all: '全部',
  };
  return map[c] || cat || '—';
}
