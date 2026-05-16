import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp } from 'lucide-react';

import { fetchRankings } from '../api/public';
import type { RankingItem } from '../components/rankings/RankingCard';
import { RankingsPageTable } from '../components/rankings/RankingsPageTable';
import { EmptyState } from '../components/common/EmptyState';
import { categoryLabel } from '../lib/categoryLabels';

const RANGES = [
  { id: 'today', label: '今日' },
  { id: '7d', label: '7 天' },
  { id: '30d', label: '30 天' },
] as const;

/** 与后端 map_global_category 对齐；不含 application（流水线不会产出该分类） */
const CATS = [
  { id: 'all', label: '全部' },
  { id: 'model', label: '模型' },
  { id: 'tool', label: '工具' },
  { id: 'industry', label: '行业' },
  { id: 'open_source', label: '开源' },
] as const;

const chipBase =
  'inline-flex h-9 shrink-0 items-center rounded-full border px-[14px] text-[14px] transition-colors';
const chipInactive = `${chipBase} border-[#D8E2F0] bg-white font-semibold text-[#475569]`;
const chipActive = `${chipBase} border-[#1463FF] bg-[#1463FF] font-bold text-white`;

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
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [items, setItems] = useState<RankingItem[]>([]);
  const [meta, setMeta] = useState<{ updated_at: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setErr(null);
    fetchRankings({ range, category, limit: 50, q: debouncedQ || undefined })
      .then((r) => {
        setItems(r.items);
        setMeta({ updated_at: r.updated_at });
      })
      .catch((e: Error) => setErr(e.message));
  }, [range, category, debouncedQ]);

  const sidebarTrends = useMemo(() => trendHints(items), [items]);
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? range;

  return (
    <div className="page-container">
      <header className="mb-6 border-b border-[#E2E8F0] pb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <h1 className="font-headline text-[30px] font-extrabold leading-[1.25] tracking-[-0.02em] text-[#0F172A]">
              {range === 'today' ? '今日 AI Pulse 信息榜单' : `AI Pulse 信息榜单 · ${rangeLabel}`}
            </h1>
            <p className="mt-2 max-w-[760px] text-[15px] leading-[1.7] text-[#64748B]">
              先看清发生了什么，再对照「为什么值得看」与「对你意味着什么」。
            </p>
            {meta ? (
              <p className="mt-2 text-[13px] font-medium tabular-nums text-[#64748B]">
                <time dateTime={meta.updated_at}>{formatUpdatedAtLabel(meta.updated_at)}</time>
              </p>
            ) : null}
          </div>

          {!err && items.length > 0 ? (
            <div className="w-full shrink-0 lg:w-[min(100%,300px)] xl:w-[320px]">
              <div className="rounded-[18px] border border-[#D8E2F0] bg-white px-[18px] py-5 lg:min-h-[140px]">
                <h3 className="font-headline text-[15px] font-extrabold text-[#0F172A]">今日趋势</h3>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#64748B]">当前列表分类分布</p>
                <ul className="mt-3 space-y-2 text-[13px] leading-[1.6] text-[#64748B]">
                  {sidebarTrends.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={range === r.id ? chipActive : chipInactive}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={category === c.id ? chipActive : chipInactive}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 搜索：与时间/分类筛选同一左缘，宽与主内容一致 */}
      <div className="mb-8 mt-8 max-w-[720px] space-y-4">
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#94A3B8]"
            aria-hidden
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索行业、场景或关键词，例如：教育、电商、Agent、内容创作"
            className="h-12 w-full rounded-2xl border border-[#D8E2F0] bg-white py-3 pl-11 pr-4 text-sm text-[#0F172A] shadow-sm outline-none placeholder:text-[#94A3B8] focus:border-[#94A3B8] focus:ring-2 focus:ring-[#1463FF]/15"
            aria-label="搜索榜单事件"
            autoComplete="off"
          />
        </div>
        {debouncedQ ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-slate-500">
            <span>
              搜索「{debouncedQ}」的相关事件 · 共 {items.length} 条
            </span>
            <button
              type="button"
              className="font-normal text-[#2563EB] underline-offset-2 hover:underline"
              onClick={() => {
                setSearchInput('');
                setDebouncedQ('');
              }}
            >
              清空搜索
            </button>
          </div>
        ) : null}
      </div>

      {err ? (
        <div className="card-surface-muted mb-6 px-5 py-4 text-sm">
          <p className="font-headline font-semibold text-slate-900">暂时无法加载榜单</p>
          <p className="mt-2 leading-relaxed text-slate-600">{err}</p>
          <Link to="/" className="btn-secondary mt-4 inline-flex px-4 py-2 text-xs font-semibold no-underline">
            返回首页
          </Link>
        </div>
      ) : null}

      {!err && items.length > 0 ? (
        <div className="min-w-0">
          <RankingsPageTable items={items} />
          <p className="mt-4 text-center text-[13px] text-[#64748B]">
            共 {items.length} 条 · 可调整时间范围与分类
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#64748B] md:text-center">
            Pulse Score 用于衡量事件本身的关注价值，并作为榜单主要排序依据。时间范围只决定事件是否进入对应榜单。
            不代表投资、职业或商业决策建议。
          </p>
        </div>
      ) : null}

      {!err && items.length === 0 && debouncedQ ? (
        <EmptyState title="没有找到相关事件" description="试试更宽泛的关键词，例如「教育」「电商」「Agent」。也可切换时间范围与分类。">
          <button
            type="button"
            className="btn-secondary mt-6 inline-flex px-6 py-2.5 text-sm font-semibold"
            onClick={() => {
              setSearchInput('');
              setDebouncedQ('');
            }}
          >
            清空搜索
          </button>
        </EmptyState>
      ) : null}

      {!err && items.length === 0 && !debouncedQ ? (
        <EmptyState
          title="暂无匹配结果"
          description="当前筛选条件下没有可展示的榜单事件。可切换时间范围或分类，或确认后端已运行 daily_rankings。"
          actionLabel="返回首页"
          actionTo="/"
          actionVariant="secondary"
        />
      ) : null}
    </div>
  );
}
