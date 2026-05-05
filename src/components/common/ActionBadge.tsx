import { displayActionSuggestion } from '../../lib/insightFallback';

type Props = {
  suggestion: string | undefined | null;
  className?: string;
};

/** 现在试用 → 蓝；先观望 → 琥珀；可以忽略 → 灰 */
export function ActionBadge({ suggestion, className = '' }: Props) {
  const raw = displayActionSuggestion(suggestion);
  let pill =
    'border border-slate-200 bg-slate-50 text-slate-600';
  if (raw.includes('试用')) {
    pill = 'border border-[#005bc1]/25 bg-[#005bc1]/10 text-[#004291]';
  } else if (raw.includes('观望')) {
    pill = 'border border-amber-300/80 bg-amber-50 text-amber-900';
  } else if (raw.includes('忽略')) {
    pill = 'border border-slate-200 bg-slate-100 text-slate-600';
  }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${pill} ${className}`}>
      {raw}
    </span>
  );
}
