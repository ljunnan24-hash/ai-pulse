/**
 * 分类 pill 配色（避免蓝色系，与筛选主色 chips 区分）。
 * 背景浅、文字饱和适中，保证可读性。
 */
export function categoryPillClass(cat: string | undefined | null): string {
  const c = (cat || '').trim().toLowerCase();
  const map: Record<string, string> = {
    model: 'bg-violet-50 text-violet-900 ring-1 ring-violet-200/90',
    model_update: 'bg-violet-50 text-violet-900 ring-1 ring-violet-200/90',
    tool: 'bg-amber-50 text-amber-950 ring-1 ring-amber-200/90',
    tool_product: 'bg-amber-50 text-amber-950 ring-1 ring-amber-200/90',
    industry: 'bg-rose-50 text-rose-900 ring-1 ring-rose-200/90',
    open_source: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/90',
    application: 'bg-fuchsia-50 text-fuchsia-900 ring-1 ring-fuchsia-200/90',
    enterprise: 'bg-orange-50 text-orange-900 ring-1 ring-orange-200/90',
    policy: 'bg-stone-100 text-stone-900 ring-1 ring-stone-300/80',
    all: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300/80',
  };
  return map[c] || 'bg-slate-100 text-slate-800 ring-1 ring-slate-300/80';
}

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
