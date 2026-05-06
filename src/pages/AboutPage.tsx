import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="page-container pb-16 md:pb-20">
      <header className="mb-8 md:mb-10">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">关于 AI Pulse</p>
        <h1 className="heading-page mt-3">AI Pulse 是什么</h1>
        <p className="mt-4 max-w-2xl text-body">
          AI Pulse 是一款<strong className="font-medium text-slate-800"> AI 信息搜集与整理产品</strong>
          ：我们从多个公开渠道持续追踪 AI 领域的关键进展，帮助你<strong className="font-medium text-slate-800">
            收集、筛选、去重并结构化呈现信息
          </strong>
          ，让你更快知道「发生了什么」，再决定是否深入。
        </p>
      </header>

      <div className="space-y-6 md:space-y-9">
        <section className="card-surface p-5 md:p-7">
          <h2 className="heading-section text-slate-900">我们为什么做这个产品</h2>
          <div className="mt-4 space-y-3 text-body">
            <p>
              AI 资讯噪声高、节奏快，单靠热搜很难建立<strong className="font-medium text-slate-800">可追溯的事实上下文</strong>。
              AI Pulse 先把分散线索收敛成「事件级」条目，再附上出处与轻量价值提示，让你把时间花在真正相关的方向上。
            </p>
          </div>
        </section>

        <section className="card-surface p-5 md:p-7">
          <h2 className="heading-section text-slate-900">我们的优势</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-body marker:text-slate-400">
            <li>
              <strong className="font-medium text-slate-800">多源追踪</strong>：持续收录主流技术与行业渠道，保留链接便于核对。
            </li>
            <li>
              <strong className="font-medium text-slate-800">筛选与去重</strong>：用结构化字段与评分示意降低重复阅读成本。
            </li>
            <li>
              <strong className="font-medium text-slate-800">信息先行</strong>：默认先讲事实摘要，再补充「为什么值得看」「对你意味着什么」等辅助层。
            </li>
            <li>
              <strong className="font-medium text-slate-800">轻量判断提示</strong>：提供启发式解读与周报归纳，但不替你下最终决定。
            </li>
          </ul>
        </section>

        <section className="card-surface-muted p-5 md:p-7">
          <h2 className="heading-section text-slate-900">我们不做什么</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              我们不是追求流量的标题聚合站；优先可核对与可复盘的信息。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              我们不是 opinion-first 的评论站；观点始终建立在可追溯的事实与来源之上。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              Pulse Score 与标签仅为<strong className="font-medium text-slate-900">排序与对照辅助</strong>
              ，不构成投资建议或采购结论。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              我们不替用户做最终决定；职业与安全边界内的取舍仍由你判断。
            </li>
          </ul>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card-surface-muted p-5 md:p-6">
            <h2 className="font-headline text-lg font-bold text-slate-900">适合谁</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                需要快速建立事实上下文、再决定要不要深入读原文的人
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                希望用同一套信息结构对照多条信号的产品与工程团队
              </li>
            </ul>
          </div>
          <div className="card-surface-muted p-5 md:p-6">
            <h2 className="font-headline text-lg font-bold text-slate-900">不适合谁</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                需要逐条实时推送、且不愿承受任何筛选的人
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                希望产品直接给出尽调或合规结论的场景
              </li>
            </ul>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link to="/rankings" className="btn-primary-lg px-8 no-underline">
            浏览信息榜单
          </Link>
          <Link to="/archive" className="btn-secondary px-8 no-underline">
            历史归档
          </Link>
        </div>
      </div>
    </div>
  );
}
