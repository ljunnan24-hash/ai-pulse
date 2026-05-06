type Props = {
  score: number;
  label?: string;
  className?: string;
  /** pill：更强的 Pulse 存在感（榜单 / 信号卡） */
  variant?: 'default' | 'pill';
};

export function ScoreBadge({ score, label = 'Pulse', className = '', variant = 'default' }: Props) {
  const v = Number.isFinite(score) ? score : NaN;
  const num = Number.isFinite(v) ? v.toFixed(1) : '—';

  if (variant === 'pill') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-[#005bc1]/25 bg-gradient-to-b from-white to-[#005bc1]/[0.08] px-3.5 py-1.5 font-headline shadow-sm ${className}`}
      >
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-[#005bc1]/90">{label}</span>
        <span className="text-lg font-black tabular-nums leading-none text-[#005bc1]">{num}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-lg bg-[#005bc1]/10 px-2.5 py-1 font-headline tabular-nums ${className}`}
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#005bc1]/80">{label}</span>
      <span className="text-base font-bold text-[#005bc1]">{num}</span>
    </span>
  );
}
