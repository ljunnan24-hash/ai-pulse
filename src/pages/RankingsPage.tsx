import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

import { fetchRankings } from '../api/public';
import type { RankingItem } from '../components/rankings/RankingCard';
import { RankingsTopThree } from '../components/rankings/RankingsTopThree';
import { RankingsInformationList } from '../components/rankings/RankingsInformationList';
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

function formatUpdatedAtLabel(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `更新于 ${y} / ${m} / ${day} ${h}:${min}`;
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
  const restAfterTop = items.length > 3 ? items.slice(3) : [];

  return (
    <div className="page-container bg-slate-50">
      <header className="mb-6 flex flex-col gap-3 border-b border-slate-200/90 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="heading-page">
            {range === 'today' ? '今日 AI Pulse 信息榜单' : `AI Pulse 信息榜单 · ${rangeLabel}`}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            先看清发生了什么，再对照「为什么值得看」与「对你意味着什么」。Pulse Score 仅辅助排序，不代表结论。
          </p>
        </div>
        {meta ? (
          <p className="shrink-0 text-xs tabular-nums text-slate-500 md:text-right">
            <time dateTime={meta.updated_at}>{formatUpdatedAtLabel(meta.updated_at)}</time>
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

      {!err && items.length > 0 ? <RankingsTopThree items={items} /> : null}

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
        <div className="lg:col-span-8">
          {!err && restAfterTop.length > 0 ? (
            <div className="space-y-4">
              <h2 className="font-headline text-sm font-semibold text-slate-800">更多上榜信息</h2>
              <RankingsInformationList items={restAfterTop} rankOffset={3} />
              <p className="py-2 text-center text-xs text-slate-500">
                共 {items.length} 条：前 3 名见上方 · 可调整时间范围与分类
              </p>
            </div>
          ) : null}
          {!err && items.length > 0 && items.length <= 3 ? (
            <p className="mt-2 text-center text-sm text-slate-500">以上为当前筛选下的全部上榜条目。</p>
          ) : null}
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
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-600">
              {sidebarTrends.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-surface p-5">
            <h3 className="font-headline text-sm font-semibold text-slate-900">订阅周报</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              周报按主题整理信息，并附轻量价值提示，方便你决定要不要深入。
            </p>
            <Link
              to="/subscribe"
              className="btn-primary mt-4 inline-flex w-full justify-center font-headline no-underline"
            >
              订阅周报
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
