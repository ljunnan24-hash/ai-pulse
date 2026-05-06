import { displayActionSuggestion } from '../../lib/insightFallback';

type Props = {
  suggestion: string | undefined | null;
  className?: string;
};

/** 现在试用 → 蓝；先观望 → 琥珀；可以忽略 → 灰；高度与 ScoreBadge subtle 对齐 */
export function ActionBadge({ suggestion, className = '' }: Props) {
  const raw = displayActionSuggestion(suggestion);
  let pill =
    'border border-slate-200 bg-white text-slate-600';
  if (raw.includes('试用')) {
    pill = 'border border-primary/20 bg-primary/5 text-primary';
  } else if (raw.includes('观望')) {
    pill = 'border border-amber-200 bg-amber-50 text-amber-900';
  } else if (raw.includes('忽略')) {
    pill = 'border border-slate-200 bg-slate-100 text-slate-600';
  }
  return (
    <span
      className={`inline-flex h-7 max-h-7 items-center rounded-md px-2.5 text-xs font-medium ${pill} ${className}`}
    >
      {raw}
    </span>
  );
}
