/**
 * 桌面端榜单表头，与 RankingTableRow 共用 .ranking-table-grid
 */
export function RankingTableHeader() {
  return (
    <div
      className="ranking-table-grid border-b border-slate-200 bg-slate-50/90 px-2 py-2.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 md:px-3"
      role="row"
    >
      <div className="text-center" role="columnheader">
        排名
      </div>
      <div className="text-left" role="columnheader">
        Pulse Score
      </div>
      <div className="min-w-0 text-left" role="columnheader">
        判断与原文标题
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
