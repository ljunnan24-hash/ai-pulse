type Props = {
  /** 首页 Top3 与排行榜页标题可区分 */
  judgmentColumnLabel?: string;
  /** 排行榜其余名次：无操作列，主列为事件标题 */
  layout?: 'home' | 'rankings-rest';
};

/**
 * 桌面端榜单表头，与 RankingTableRow 共用 grid class
 */
export function RankingTableHeader({
  judgmentColumnLabel = '判断（今日一句话）',
  layout = 'home',
}: Props) {
  const gridCls = layout === 'rankings-rest' ? 'ranking-table-grid--rankings-rest' : 'ranking-table-grid';

  return (
    <div
      className={`${gridCls} border-b border-slate-200 bg-white px-2 py-3 text-[0.6875rem] font-semibold tracking-wide text-slate-500 md:px-3`}
      role="row"
    >
      <div
        className={
          layout === 'rankings-rest'
            ? '-mx-2 w-[56px] min-w-[56px] max-w-[56px] shrink-0 border-r border-slate-200 bg-slate-100 px-2 text-center md:-mx-3 md:px-3'
            : '-mx-2 w-[64px] min-w-[64px] max-w-[64px] shrink-0 border-r border-slate-200 bg-slate-100 px-2 text-center md:-mx-3 md:px-3'
        }
        role="columnheader"
      >
        排名
      </div>
      <div
        className={
          layout === 'rankings-rest'
            ? 'w-[80px] min-w-[80px] max-w-[80px] shrink-0 bg-slate-50 text-left'
            : 'w-[96px] min-w-[96px] max-w-[96px] shrink-0 bg-slate-50 text-left'
        }
        role="columnheader"
      >
        Pulse Score
      </div>
      <div className="min-w-0 bg-slate-50 text-left" role="columnheader">
        {layout === 'rankings-rest' ? '事件标题' : judgmentColumnLabel}
      </div>
      <div className="min-w-0 bg-slate-50 text-left" role="columnheader">
        对你意味着什么
      </div>
      <div className="bg-slate-50 text-center" role="columnheader">
        分类
      </div>
      <div className="bg-slate-50 text-left" role="columnheader">
        时间
      </div>
      {layout === 'home' ? (
        <div className="bg-slate-50 text-right" role="columnheader">
          操作
        </div>
      ) : null}
    </div>
  );
}
