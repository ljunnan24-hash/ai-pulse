type Props = {
  score: number;
  label?: string;
  className?: string;
};

export function ScoreBadge({ score, label = 'Pulse', className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-lg bg-[#005bc1]/10 px-2.5 py-1 font-headline tabular-nums ${className}`}
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#005bc1]/80">{label}</span>
      <span className="text-base font-bold text-[#005bc1]">{Number.isFinite(score) ? score.toFixed(1) : '—'}</span>
    </span>
  );
}
