import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRankings } from '../api/public';

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

export default function RankingsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('today');
  const [category, setCategory] = useState<(typeof CATS)[number]['id']>('all');
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchRankings>>['items']>([]);
  const [meta, setMeta] = useState<{ updated_at: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    fetchRankings({ range, category, limit: 50 })
      .then((r) => {
        setItems(r.items);
        setMeta({ updated_at: r.updated_at });
      })
      .catch((e: Error) => setErr(e.message));
  }, [range, category]);

  return (
    <div className="max-w-5xl mx-auto pt-6 pb-20">
      <h1 className="font-headline font-extrabold text-4xl text-on-surface mb-2">AI Pulse 排行榜</h1>
      <p className="text-on-surface-variant mb-6">免费公开 · 多源聚合 · Pulse Score 排序</p>

      <div className="flex flex-wrap gap-3 mb-6">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold ${range === r.id ? 'bg-primary text-surface-container-lowest' : 'bg-surface-container-low text-on-surface'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${category === c.id ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-low text-on-surface-variant'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {meta ? <p className="text-xs text-on-surface-variant mb-4">更新：{new Date(meta.updated_at).toLocaleString()}</p> : null}
      {err ? <p className="text-red-600 text-sm mb-4">{err}</p> : null}

      <div className="space-y-3">
        {items.map((row, i) => (
          <div
            key={row.id}
            className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 flex flex-col md:flex-row md:items-start gap-4"
          >
            <div className="text-primary font-black text-xl w-10">{i + 1}</div>
            <div className="flex-1">
              <Link to={`/events/${row.id}`} className="font-headline font-bold text-lg text-on-surface hover:text-primary">
                {row.title}
              </Link>
              <p className="text-sm text-on-surface-variant mt-2">{row.what_it_means_for_you}</p>
              <div className="flex flex-wrap gap-2 mt-3 text-xs text-on-surface-variant">
                <span>Pulse {row.ranking_score.toFixed(1)}</span>
                {row.score_delta !== 0 ? <span>Δ {row.score_delta.toFixed(1)}</span> : null}
                <span>{row.category}</span>
                <span>{row.source_type}</span>
                <span>{row.source_count} 来源</span>
                <span>{row.action_suggestion}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!err && items.length === 0 ? (
        <p className="text-on-surface-variant text-sm mt-8">暂无数据。请先运行后端 `daily_rankings` 任务。</p>
      ) : null}

      <aside className="mt-12 rounded-2xl bg-primary-container/30 p-6 border border-primary/10">
        <h3 className="font-headline font-bold text-on-surface mb-2">订阅每周判断报告</h3>
        <p className="text-sm text-on-surface-variant mb-4">邮件推送中文周报，周一视角复盘。</p>
        <Link to="/" className="inline-block bg-primary text-surface-container-lowest font-bold px-6 py-3 rounded-full">
          回到首页订阅
        </Link>
      </aside>
    </div>
  );
}
