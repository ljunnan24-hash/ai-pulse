import { Link } from 'react-router-dom';

export type TocItem = { id: string; label: string };

type Props = {
  items: TocItem[];
};

export function WeeklyToc({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="本期目录"
      className="rounded-2xl border border-slate-200 bg-[#f7f9fc] p-5 shadow-sm"
    >
      <p className="font-headline text-sm font-bold text-slate-900">本期目录</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className="text-slate-600 transition hover:text-[#005bc1]">
              {it.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <p className="text-xs font-semibold text-slate-600">每周邮件送达</p>
        <Link
          to="/#subscribe"
          className="mt-2 inline-flex w-full justify-center rounded-full border-2 border-[#005bc1] bg-white py-2.5 text-center font-headline text-sm font-bold text-[#005bc1] hover:bg-[#005bc1]/5"
        >
          订阅周报
        </Link>
      </div>
    </nav>
  );
}
