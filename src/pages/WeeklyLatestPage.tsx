import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchWeeklyLatest } from '../api/public';
import { Seo, absoluteUrl } from '../components/Seo';
import { WeeklyReportView } from '../components/weekly/WeeklyReportView';
import { weeklySeoDescription, weeklySeoHeadline } from '../lib/seoContent';

export default function WeeklyLatestPage() {
  const [title, setTitle] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeklyLatest()
      .then((r) => {
        setTitle(r.title);
        setReportDate(r.report_date);
        setPayload(r.payload);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <div className="mx-auto max-w-4xl pt-8">
        <p className="text-red-600">{err}</p>
        <p className="mt-4 text-sm text-slate-600">
          若尚无周报，请先在后端运行 <code className="rounded bg-slate-100 px-1">generate_weekly</code> 写入{' '}
          <code className="rounded bg-slate-100 px-1">weekly_reports</code>。
        </p>
        <Link to="/" className="mt-6 inline-block font-medium text-[#005bc1]">
          返回首页
        </Link>
      </div>
    );
  }
  if (!payload) {
    return <p className="pt-8 text-slate-500">加载中…</p>;
  }

  const headline = weeklySeoHeadline(payload, title);
  const description = weeklySeoDescription(payload, title);

  return (
    <>
      <Seo
        title={`${headline} | AI Pulse 最新周报`}
        description={description}
        path="/weekly/latest"
        type="article"
        publishedTime={reportDate || null}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline,
          description,
          datePublished: reportDate || undefined,
          dateModified: reportDate || undefined,
          mainEntityOfPage: absoluteUrl('/weekly/latest'),
          publisher: {
            '@type': 'Organization',
            name: 'AI Pulse',
            url: absoluteUrl('/'),
          },
          isAccessibleForFree: true,
        }}
      />
      <WeeklyReportView title={title} reportDate={reportDate} payload={payload} />
    </>
  );
}
