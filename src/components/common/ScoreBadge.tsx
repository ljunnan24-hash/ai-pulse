type Props = {
  score: number;
  label?: string;
  className?: string;
  /** default：列表弱化；pill：强调；subtle：最弱（首页/紧凑列表） */
  variant?: 'default' | 'pill' | 'subtle';
};

export function ScoreBadge({ score, label = 'Pulse', className = '', variant = 'default' }: Props) {
  const v = Number.isFinite(score) ? score : NaN;
  const num = Number.isFinite(v) ? v.toFixed(1) : '—';

  if (variant === 'subtle') {
    return (
      <span
        className={`inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 font-headline tabular-nums text-slate-600 ${className}`}
      >
        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-sm font-semibold text-slate-700">{num}</span>
      </span>
    );
  }

  if (variant === 'pill') {
    return (
      <span
        className={`inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 font-headline ${className}`}
      >
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">{label}</span>
        <span className="text-base font-bold tabular-nums leading-none text-primary">{num}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-7 items-baseline gap-1 rounded-md border border-slate-200 bg-white px-2 font-headline tabular-nums shadow-[var(--shadow-card)] ${className}`}
    >
      <span className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{num}</span>
    </span>
  );
}
