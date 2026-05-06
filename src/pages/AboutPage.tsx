import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="page-container pb-16 md:pb-20">
      <header className="mb-8 md:mb-10">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">关于 AI Pulse</p>
        <h1 className="heading-page mt-3">AI Pulse 是什么</h1>
        <p className="mt-4 max-w-2xl text-body">
          AI Pulse 是一套面向<strong className="font-medium text-slate-800">信号收敛与判断辅助</strong>
          的信息产品：把分散的 AI 动态整理为可评分的事件、可阅读的周报与可追溯的来源，而不是追逐标题流量的资讯聚合。
        </p>
      </header>

      <div className="space-y-6 md:space-y-9">
        <section className="card-surface p-5 md:p-7">
          <h2 className="heading-section text-slate-900">为什么不是普通资讯站</h2>
          <div className="mt-4 space-y-3 text-body">
            <p>
              资讯站默认优化「时效与点击」；AI Pulse 默认优化<strong className="font-medium text-slate-800">可解释的判断结构</strong>
              ：发生了什么、为何值得注意、对你可能意味着什么，以及相对克制的行动提示。
            </p>
            <p>
              排序与展示依赖<strong className="font-medium text-slate-800">Pulse 评分与结构化字段</strong>
              ，而不是编辑主观头条。分数用于辅助筛选与对照，最终决策仍在你。
            </p>
          </div>
        </section>

        <section className="card-surface p-5 md:p-7">
          <h2 className="heading-section text-slate-900">判断体系是什么</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-body marker:text-slate-400">
            <li>多源线索汇聚与去重，形成可跟踪的全局事件。</li>
            <li>
              Pulse Score：从新鲜度、可信度、热度、来源组合与对你价值等维度<strong className="font-medium text-slate-800">加权示意</strong>
              ，用于榜单与侧栏分解展示。
            </li>
            <li>生成结构化叙述：发生了什么、为什么重要、对你意味着什么、以及行动层面的提示词（非投资建议）。</li>
            <li>周报将一周主线、边界与噪音分层沉淀，便于复盘。</li>
          </ol>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="card-surface-muted p-5 md:p-6">
            <h2 className="font-headline text-lg font-bold text-slate-900">适合谁</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                需要快速建立上下文、再决定是否深入的技术与产品角色
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                希望用同一套评分与叙述框架对照多条信号的团队
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                愿意把「判断」留给自己、把「整理」交给系统的读者
              </li>
            </ul>
          </div>
          <div className="card-surface-muted p-5 md:p-6">
            <h2 className="font-headline text-lg font-bold text-slate-900">不适合谁</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                期待实时推送每一条传闻、且不介意噪声的用户
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                希望替代人工尽职调查或合规结论的场景（我们无法承担该职责）
              </li>
            </ul>
          </div>
        </section>

        <section className="card-surface-muted p-5 md:p-7">
          <h2 className="heading-section text-slate-900">我们不做什么</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              不承诺覆盖全网每一条 AI 消息；我们优先可核对与可复盘的信号。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              不提供「机会分」或投机导向的排序；不把产品做成营销转化漏斗。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">—</span>
              不替代你的职业判断；评分与标签均为辅助信息。
            </li>
          </ul>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link to="/rankings" className="btn-primary-lg px-8 no-underline">
            查看排行榜
          </Link>
          <Link to="/archive" className="btn-secondary px-8 no-underline">
            历史归档
          </Link>
        </div>
      </div>
    </div>
  );
}
