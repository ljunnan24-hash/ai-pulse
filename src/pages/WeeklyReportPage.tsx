import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchWeeklyByDate } from '../api/public';
import { WeeklyReportView } from '../components/weekly/WeeklyReportView';

export default function WeeklyReportPage() {
  const { date } = useParams<{ date: string }>();
  const [title, setTitle] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    setErr(null);
    fetchWeeklyByDate(date)
      .then((r) => {
        setTitle(r.title);
        setReportDate(r.report_date);
        setPayload(r.payload);
      })
      .catch((e: Error) => setErr(e.message));
  }, [date]);

  if (!date) {
    return <p className="text-on-surface-variant pt-8">缺少日期参数</p>;
  }
  if (err) {
    return (
      <div className="mx-auto max-w-4xl pt-8">
        <p className="text-red-600">{err}</p>
        <Link to="/archive" className="mt-4 inline-block text-[#005bc1]">
          返回归档
        </Link>
      </div>
    );
  }
  if (!payload) {
    return <p className="text-on-surface-variant pt-8">加载中…</p>;
  }

  return <WeeklyReportView title={title} reportDate={reportDate} payload={payload} />;
}
