import { Link } from 'react-router-dom';

export type ThesisShape = {
  headline?: string;
  summary?: string;
  trend_lines?: string[];
};

type Props = {
  thesis: ThesisShape;
};

export function WeeklyThesisCard({ thesis }: Props) {
  const lines = Array.isArray(thesis.trend_lines) ? thesis.trend_lines.filter(Boolean) : [];

  return (
    <section id="weekly-thesis" className="mb-10 scroll-mt-28 md:mb-12">
      <div className="relative overflow-hidden rounded-3xl border border-[#005bc1]/18 bg-gradient-to-br from-[#e8f2fc] via-white to-[#f4f7fb] p-7 shadow-[0_14px_44px_rgba(0,91,193,0.09)] md:p-9">
        <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#005bc1] shadow-sm ring-1 ring-[#005bc1]/15">
          本周一句话判断
        </span>

        {thesis.headline ? (
          <p className="mt-5 font-headline text-2xl font-bold leading-snug text-slate-900 md:text-[1.75rem] md:leading-snug">
            {thesis.headline}
          </p>
        ) : null}

        {thesis.summary ? (
          <p className="mt-5 text-base leading-[1.75] text-slate-700 md:text-[1.05rem]">{thesis.summary}</p>
        ) : null}

        {lines.length > 0 ? (
          <div className="mt-8 border-t border-[#005bc1]/10 pt-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">趋势线</p>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-700 md:text-[0.95rem]">
              {lines.map((line, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#005bc1]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/subscribe"
            className="inline-flex justify-center rounded-full bg-[#005bc1] px-6 py-3 text-center font-headline text-sm font-bold text-white shadow-md hover:bg-[#004a9e]"
          >
            订阅每周判断报告
          </Link>
        </div>
      </div>
    </section>
  );
}
