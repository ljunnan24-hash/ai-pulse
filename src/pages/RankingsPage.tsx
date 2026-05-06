import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchRankings } from '../api/public';
import type { RankingItem } from '../components/rankings/RankingCard';
import { buildDisplayJudgment, RankingCard } from '../components/rankings/RankingCard';
import { EmptyState } from '../components/common/EmptyState';
import { categoryLabel } from '../lib/categoryLabels';

const RANGES = [
  { id: 'today', label: '今日' },
  { id: '7d', label: '7 天' },
  { id: '30d', label: '30 天' },
] as const;

const CATS = [
  { id: 'all', label: '全部' },
  { id: 'model', label: '模型' },
  { id: 'tool', label: '工具' },
  { id: 'industry', label: '行业' },
  { id: 'open_source', label: '开源' },
  { id: 'application', label: '应用' },
] as const;

function trendHints(items: RankingItem[]): string[] {
  const counts: Record<string, number> = {};
  for (const it of items) {
    const k = (it.category || '').trim() || 'other';
    counts[k] = (counts[k] || 0) + 1;
  }
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, n]) => `${categoryLabel(cat)} · ${n} 条`);
  if (rows.length === 0) return ['当前样本较少，趋势将在数据增多后展示。'];
  return rows;
}

export default function RankingsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('today');
  const [category, setCategory] = useState<(typeof CATS)[number]['id']>('all');
  const [items, setItems] = useState<RankingItem[]>([]);
  const [meta, setMeta] = useState<{ updated_at: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    fetchRankings({ range, category, limit: 20 })
      .then((r) => {
        setItems(r.items);
        setMeta({ updated_at: r.updated_at });
      })
      .catch((e: Error) => setErr(e.message));
  }, [range, category]);

  const sidebarTrends = useMemo(() => trendHints(items), [items]);
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? range;
  const topJudgmentPreview = items[0] ? buildDisplayJudgment(items[0]) : null;

  return (
    <div className="page-container">
      <header className="mb-6 flex flex-col gap-3 border-b border-slate-200/90 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="heading-page">
            {range === 'today' ? '今日 AI Pulse 排行榜' : `AI Pulse 排行榜 · ${rangeLabel}`}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Pulse Score 综合来源可信度、时效、热度与价值；以下为当前筛选下的实时排序。
          </p>
        </div>
        {meta ? (
          <p className="shrink-0 text-xs tabular-nums text-slate-500 md:text-right">
            更新{' '}
            <time dateTime={meta.updated_at}>{new Date(meta.updated_at).toLocaleString('zh-CN')}</time>
          </p>
        ) : null}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={`filter-chip ${range === r.id ? 'filter-chip-active' : 'filter-chip-inactive'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`filter-chip ${category === c.id ? 'filter-chip-active' : 'filter-chip-inactive'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {items.length > 0 ? (
        <section
          className="card-surface-muted section-y px-5 py-5 md:px-6 md:py-6"
          aria-label={range === 'today' ? '今日判断' : '榜单判断'}
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
            {range === 'today' ? '今日判断' : '榜单判断'}
          </p>
          <p
            className={`mt-3 font-headline leading-snug md:text-xl ${
              topJudgmentPreview?.isTitleFallback
                ? 'line-clamp-3 text-base font-medium text-slate-700'
                : 'line-clamp-4 text-lg font-semibold text-slate-900'
            }`}
          >
            {topJudgmentPreview?.text || '浏览下方条目查看具体判断与依据。'}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {range === 'today' ? '基于当前榜单 Top 综合摘要。' : '基于当前筛选列表 Top 综合摘要。'}
          </p>
          <Link
            to={items[0] ? `/events/${items[0].id}` : '/rankings'}
            className="mt-4 inline-flex text-xs font-semibold text-primary hover:underline md:text-sm"
          >
            查看首条详情 →
          </Link>
        </section>
      ) : null}

      {err ? (
        <div className="card-surface-muted mb-6 px-5 py-4 text-sm">
          <p className="font-headline font-semibold text-slate-900">暂时无法加载榜单</p>
          <p className="mt-2 leading-relaxed text-slate-600">{err}</p>
          <Link to="/" className="btn-secondary mt-4 inline-flex px-4 py-2 text-xs font-semibold no-underline">
            返回首页
          </Link>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-3 lg:col-span-8">
          {items.map((row, i) => (
            <RankingCard key={row.id} rank={i + 1} item={row} variant="full" />
          ))}
          {!err && items.length === 0 ? (
            <EmptyState
              title="暂无匹配结果"
              description="当前筛选条件下没有可展示的榜单事件。可切换时间范围或分类，或确认后端已运行 daily_rankings。"
              actionLabel="返回首页"
              actionTo="/"
              actionVariant="secondary"
            />
          ) : null}
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="card-surface p-5">
            <h3 className="font-headline text-sm font-semibold text-slate-900">今日趋势</h3>
            <p className="mt-1 text-[0.7rem] text-slate-500">当前列表分类分布</p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
              {sidebarTrends.map((line, idx) => (
                <li key={idx} className="flex gap-2 border-l-2 border-slate-200 pl-2">
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-surface p-5">
            <h3 className="font-headline text-sm font-semibold text-slate-900">订阅周报</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              日报看信号，周报看<span className="text-slate-800">一周值得投入的方向</span>。
            </p>
            <Link
              to="/#subscribe"
              className="btn-secondary mt-4 inline-flex w-full justify-center font-headline no-underline"
            >
              订阅周报
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
