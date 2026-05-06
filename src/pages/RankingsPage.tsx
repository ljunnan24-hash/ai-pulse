import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchRankings } from '../api/public';
import type { RankingItem } from '../components/rankings/RankingCard';
import { RankingCard } from '../components/rankings/RankingCard';
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
    .map(([cat, n]) => `${categoryLabel(cat)}方向 · ${n} 条信号`);
  if (rows.length === 0) return ['当前榜单样本较少，趋势摘要将在数据增多后展示。'];
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
  const catLabel = CATS.find((c) => c.id === category)?.label ?? category;

  return (
    <div className="mx-auto max-w-7xl pb-20 pt-4 md:pt-6">
      <header className="mb-8 md:mb-10">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
          {range === 'today' ? '今日 AI Pulse 排行榜' : `AI Pulse 排行榜 · ${rangeLabel}`}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
          基于来源可信度、新鲜度、热度、用户价值与 AI 相关性综合评分（Pulse Score）。每日打开一次，掌握当日最值得关注的 AI 信号。
        </p>

        {meta ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 border-[#005bc1]/40 pl-4 text-sm text-slate-600">
            <span>
              <span className="font-semibold text-slate-800">更新时间</span>
              <span className="mx-1.5 text-slate-300">·</span>
              {new Date(meta.updated_at).toLocaleString('zh-CN')}
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <span className="font-semibold text-slate-800">当前事件</span> {items.length} 条
            </span>
            <span className="text-slate-300">|</span>
            <span>
              范围：<span className="font-medium text-slate-800">{rangeLabel}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              分类：<span className="font-medium text-slate-800">{catLabel}</span>
            </span>
          </div>
        ) : null}
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              range === r.id ? 'bg-[#005bc1] text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
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
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              category === c.id ? 'bg-[#005bc1]/10 text-[#004291] ring-2 ring-[#005bc1]/30' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {err ? <p className="mb-6 text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="space-y-4 lg:col-span-8">
          {items.map((row, i) => (
            <RankingCard key={row.id} rank={i + 1} item={row} variant="full" />
          ))}
          {!err && items.length === 0 ? (
            <p className="text-sm text-slate-600">暂无数据。请先运行后端 `daily_rankings`。</p>
          ) : null}
        </div>

        <aside className="space-y-8 lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-headline text-lg font-bold text-slate-900">今日趋势</h3>
            <p className="mt-1 text-xs text-slate-500">基于当前榜单的分类粗略聚合</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {sidebarTrends.map((line, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#005bc1]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[#005bc1]/20 bg-gradient-to-br from-[#005bc1]/5 to-white p-6 shadow-sm">
            <h3 className="font-headline text-lg font-bold text-slate-900">订阅周报</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              排行榜告诉你<strong className="text-slate-800">今天发生了什么</strong>；
              周报告诉你这一周<strong className="text-slate-800">真正值得投入什么</strong>。
            </p>
            <Link
              to="/#subscribe"
              className="mt-5 inline-flex w-full justify-center rounded-full bg-[#005bc1] py-3 text-center font-headline text-sm font-bold text-white shadow-sm hover:bg-[#004a9e]"
            >
              订阅周报
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
