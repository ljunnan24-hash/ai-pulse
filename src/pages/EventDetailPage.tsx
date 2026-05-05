import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchEventDetail } from '../api/public';
import type { EventDetailResponse } from '../api/public';

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [data, setData] = useState<EventDetailResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(eventId);
    if (!Number.isFinite(id)) {
      setErr('无效的事件 ID');
      return;
    }
    setErr(null);
    fetchEventDetail(id)
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, [eventId]);

  if (err) {
    return <p className="text-red-600 pt-8">{err}</p>;
  }
  if (!data) {
    return <p className="text-on-surface-variant pt-8">加载中…</p>;
  }

  const sb = data.score_breakdown;

  return (
    <div className="max-w-5xl mx-auto pt-6 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-8 space-y-8">
        <Link to="/rankings" className="text-sm text-primary font-medium">
          ← 返回排行榜
        </Link>
        <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-on-surface">{data.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-on-surface-variant">
          <span className="px-2 py-1 rounded-full bg-surface-container-low">{data.category}</span>
          <span>Pulse {data.ranking_score.toFixed(1)}</span>
          <span>{data.published_at ? new Date(data.published_at).toLocaleString() : '—'}</span>
        </div>

        <section>
          <h2 className="font-headline font-bold text-xl mb-2">发生了什么</h2>
          <p className="text-on-surface leading-relaxed">{data.what_happened || '—'}</p>
        </section>
        <section>
          <h2 className="font-headline font-bold text-xl mb-2">为什么重要</h2>
          <p className="text-on-surface leading-relaxed">{data.why_important || '—'}</p>
        </section>
        <section>
          <h2 className="font-headline font-bold text-xl mb-2">对你意味着什么</h2>
          <p className="text-on-surface leading-relaxed">{data.what_it_means_for_you || '—'}</p>
        </section>
        <section>
          <h2 className="font-headline font-bold text-xl mb-2">建议</h2>
          <p className="text-on-surface font-bold text-primary">{data.action_suggestion}</p>
        </section>

        <section>
          <h2 className="font-headline font-bold text-xl mb-4">来源</h2>
          <ul className="space-y-3">
            {data.sources.map((s) => (
              <li key={`${s.raw_item_id}-${s.url}`} className="text-sm border border-outline-variant/15 rounded-xl p-4 bg-surface-container-low">
                <a href={s.url} target="_blank" rel="noreferrer" className="text-primary font-medium break-all">
                  {s.url}
                </a>
                <p className="text-on-surface-variant mt-1">
                  {s.source_name} · {s.source_type}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="lg:col-span-4 space-y-6">
        <div className="rounded-2xl border border-outline-variant/15 p-5 bg-surface-container-low">
          <h3 className="font-headline font-bold mb-3">评分维度</h3>
          <ul className="text-sm space-y-2 text-on-surface-variant">
            <li>新鲜度：{sb.freshness?.toFixed(1) ?? '—'}</li>
            <li>可信度：{sb.trust?.toFixed(1) ?? '—'}</li>
            <li>热度：{sb.heat?.toFixed(1) ?? '—'}</li>
            <li>用户价值：{sb.user_value?.toFixed(1) ?? '—'}</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-outline-variant/15 p-5 bg-surface-container-low">
          <h3 className="font-headline font-bold mb-3">相关事件</h3>
          <ul className="space-y-2">
            {data.related_events.map((r) => (
              <li key={r.id}>
                <Link to={`/events/${r.id}`} className="text-primary text-sm hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-primary-container/30 p-5 border border-primary/10">
          <h3 className="font-headline font-bold mb-2">订阅周报</h3>
          <p className="text-sm text-on-surface-variant mb-3">获取每周 AI 判断报告（中文）。</p>
          <Link to="/" className="text-primary font-bold">
            去订阅 →
          </Link>
        </div>
      </aside>
    </div>
  );
}
