type Props = {
  /** 首页 Top5 与排行榜页标题可区分 */
  judgmentColumnLabel?: string;
};

/**
 * 桌面端榜单表头，与 RankingTableRow 共用 .ranking-table-grid
 */
export function RankingTableHeader({
  judgmentColumnLabel = '判断（今日一句话）',
}: Props) {
  return (
    <div
      className="ranking-table-grid border-b border-slate-200 bg-slate-50 px-2 py-3 text-[0.6875rem] font-semibold tracking-wide text-slate-500 md:px-3"
      role="row"
    >
      <div className="text-center" role="columnheader">
        排名
      </div>
      <div className="text-left" role="columnheader">
        Pulse Score
      </div>
      <div className="min-w-0 text-left" role="columnheader">
        {judgmentColumnLabel}
      </div>
      <div className="min-w-0 text-left" role="columnheader">
        对你意味着什么
      </div>
      <div className="text-center" role="columnheader">
        分类
      </div>
      <div className="text-left" role="columnheader">
        时间
      </div>
      <div className="text-right" role="columnheader">
        操作
      </div>
    </div>
  );
}
