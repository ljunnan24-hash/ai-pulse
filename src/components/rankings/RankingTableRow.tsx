import { Link } from 'react-router-dom';

import type { RankingItem } from './RankingCard';
import { buildDisplayJudgment } from './RankingCard';
import { categoryLabel } from '../../lib/categoryLabels';
import { displayActionSuggestion, displayInsightSummary } from '../../lib/insightFallback';
import { formatRelativeTime } from '../../lib/formatRelativeTime';
import { splitTitleForDisplay } from '../../lib/titleDisplay';

/** 排行榜页：金银铜圆章；首页 Top5：大号蓝色数字（设计稿） */
function RankMedal({ rank }: { rank: number }) {
  const medal = [
    'bg-amber-100 text-amber-900 ring-2 ring-amber-300/80',
    'bg-slate-200 text-slate-800 ring-2 ring-slate-400/70',
    'bg-orange-100 text-orange-950 ring-2 ring-orange-300/80',
  ];
  if (rank <= 3) {
    return (
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${medal[rank - 1]}`}
      >
        {rank}
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center font-headline text-sm font-semibold tabular-nums text-slate-600">
      {rank}
    </span>
  );
}

function RankNumericBlue({ rank }: { rank: number }) {
  return (
    <span className="font-headline text-2xl font-bold tabular-nums leading-none text-primary md:text-[1.75rem]">{rank}</span>
  );
}

function RowActionLink({ item }: { item: RankingItem }) {
  const sug = displayActionSuggestion(item.action_suggestion);
  const tryNow = sug.includes('试用');
  const cls = tryNow
    ? 'border-primary bg-white text-primary hover:bg-primary/5'
    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50';
  return (
    <Link
      to={`/events/${item.id}`}
      className={`inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold no-underline transition-colors`}
    >
      {tryNow ? '现在试用' : '继续阅读'}
    </Link>
  );
}

type Props = {
  rank: number;
  item: RankingItem;
  /** 首页 Top5：无分类/时间列，排名为大号蓝字 */
  variant: 'home' | 'rankings';
};

export function RankingTableRow({ rank, item, variant }: Props) {
  const jd = buildDisplayJudgment(item);
  const split = splitTitleForDisplay(item.title);
  const subRaw =
    split.secondary || (jd.text.trim() !== item.title.trim() ? item.title : '');
  const sub = subRaw && subRaw.trim() !== jd.text.trim() ? subRaw : '';
  const means = displayInsightSummary(item.what_it_means_for_you, item.what_happened);
  const useMedals = variant === 'rankings';

  return (
    <tr className="transition-colors hover:bg-slate-50/60">
      <td className="whitespace-nowrap px-3 py-3.5 align-middle md:px-4">
        {useMedals ? <RankMedal rank={rank} /> : <RankNumericBlue rank={rank} />}
      </td>
      <td className="whitespace-nowrap px-3 py-3.5 align-middle md:px-4">
        <span className="font-headline text-base font-bold tabular-nums text-primary">{item.ranking_score.toFixed(1)}</span>
      </td>
      <td className="max-w-[12rem] px-3 py-3.5 align-top md:max-w-none md:px-4">
        <div className="font-headline text-sm font-semibold leading-snug text-[#111827] [overflow-wrap:anywhere] line-clamp-2 md:text-[0.95rem]">
          {jd.text}
        </div>
        {sub ? (
          <div className="mt-1.5 text-xs leading-snug text-[#666666] [overflow-wrap:anywhere] line-clamp-2">
            <span className="text-slate-400">原文标题：</span>
            {sub}
          </div>
        ) : null}
      </td>
      <td className="hidden max-w-xs px-3 py-3.5 align-top text-sm leading-relaxed text-[#374151] md:table-cell md:px-4 lg:max-w-md">
        <span className="line-clamp-2 [overflow-wrap:anywhere]">{means}</span>
      </td>
      {variant === 'rankings' ? (
        <>
          <td className="hidden whitespace-nowrap px-3 py-3.5 align-top text-xs lg:table-cell lg:px-4">
            <span className="rounded-md bg-[#E8F4FF] px-2 py-0.5 font-medium text-primary">{categoryLabel(item.category)}</span>
          </td>
          <td className="hidden whitespace-nowrap px-3 py-3.5 align-top text-xs tabular-nums text-slate-500 xl:table-cell xl:px-4">
            {formatRelativeTime(item.published_at)}
          </td>
        </>
      ) : null}
      <td className="whitespace-nowrap px-3 py-3.5 align-middle text-right md:px-4">
        <RowActionLink item={item} />
      </td>
    </tr>
  );
}
