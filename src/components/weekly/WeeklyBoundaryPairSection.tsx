import type { ReactNode } from 'react';

import { linesFromBoundaryField } from './weeklyPayloadUtils';

function takeThree(lines: string[]): string[] {
  return lines.slice(0, 3);
}

const LABELS = [
  { pos: '适合', neg: '不适合' },
  { pos: '能做', neg: '不能完全替代' },
] as const;

type Props = {
  rows: Record<string, unknown>[];
};

function ListColumn({
  label,
  lines,
  dotClass,
}: {
  label: string;
  lines: string[];
  dotClass: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
      <ul className="mt-2 space-y-2.5 text-[13px] leading-relaxed text-[#475569]">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${dotClass}`} aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CannotColumn({
  label,
  lines,
}: {
  label: string;
  lines: string[];
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">{label}</p>
      <ul className="mt-2 space-y-2.5 text-[13px] leading-relaxed text-[#475569]">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-400" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** @returns 卡片主体；无可用内容时返回 null */
function buildBoundaryBody(row: Record<string, unknown>, lab: (typeof LABELS)[number]): ReactNode | null {
  const q = String(row.question ?? '').trim();
  const can = takeThree(linesFromBoundaryField(row.can_do));
  const cannot = takeThree(linesFromBoundaryField(row.cannot_do));
  const fallback = String(row.conclusion ?? '').trim();

  const dualComplete = can.length > 0 && cannot.length > 0;

  if (dualComplete) {
    return (
      <div className="mt-5 grid flex-1 gap-6 sm:grid-cols-2">
        <ListColumn label={lab.pos} lines={can} dotClass="bg-emerald-400" />
        <CannotColumn label={lab.neg} lines={cannot} />
      </div>
    );
  }

  if (fallback) {
    return <p className={`text-[13px] leading-relaxed text-[#475569] ${q ? 'mt-4' : ''}`}>{fallback}</p>;
  }

  const cols: ReactNode[] = [];
  if (can.length > 0) {
    cols.push(<ListColumn key="can" label={lab.pos} lines={can} dotClass="bg-emerald-400" />);
  }
  if (cannot.length > 0) {
    cols.push(<CannotColumn key="cannot" label={lab.neg} lines={cannot} />);
  }
  if (cols.length === 0) {
    return null;
  }

  return <div className={`mt-5 grid gap-6 ${cols.length === 2 ? 'sm:grid-cols-2' : ''}`}>{cols}</div>;
}

/** 是否存在任一可渲染的能力边界卡（用于外层决定是否展示模块） */
export function weeklyBoundaryHasContent(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  return rows.slice(0, 2).some((row, idx) => {
    const lab = LABELS[idx] ?? LABELS[0];
    return buildBoundaryBody(row, lab) !== null;
  });
}

/** 能力边界：双列仅在 can/cannot 均有条目时出现；否则结论段落或单列列表，不使用「—」占位 */
export function WeeklyBoundaryPairSection({ rows }: Props) {
  if (rows.length === 0) return null;

  const pair = rows.slice(0, 2);

  const cards = pair.flatMap((row, idx) => {
    const lab = LABELS[idx] ?? LABELS[0];
    const body = buildBoundaryBody(row, lab);
    if (!body) return [];

    const q = String(row.question ?? '').trim();

    return [
      <article
        key={idx}
        className="flex flex-col rounded-[12px] border border-[#D8E2F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-6"
      >
        {q ? (
          <h3 className="font-headline text-[15px] font-bold leading-snug text-[#0F172A] md:text-[16px]">{q}</h3>
        ) : null}
        {body}
      </article>,
    ];
  });

  if (cards.length === 0) return null;

  return <div className="grid gap-6 md:grid-cols-2 md:items-stretch">{cards}</div>;
}
