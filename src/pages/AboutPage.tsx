import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl pb-24 pt-8 md:pt-10">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#005bc1]">关于 AI Pulse</p>
      <h1 className="mt-3 font-headline text-4xl font-extrabold tracking-tight text-slate-900 md:text-[2.75rem] md:leading-tight">
        我们不是资讯站，而是 <span className="text-[#005bc1]">AI 信号判断系统</span>
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-slate-600">
        AI Pulse 把全球 AI 动态收敛成<strong className="text-slate-800">可评分、可解释、可行动</strong>
        的信号与周报，帮助你把注意力花在「值得判断」的事情上。
      </p>

      <section className="mt-14">
        <h2 className="font-headline text-xl font-bold text-slate-900">适合谁</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {['非技术职场人', '创业者', '小团队', '独立开发者'].map((x) => (
            <li
              key={x}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#005bc1]/10 text-[#005bc1]">
                <Sparkles className="h-4 w-4" />
              </span>
              {x}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="font-headline text-xl font-bold text-slate-900">我们如何工作</h2>
        <ol className="mt-6 space-y-4">
          {[
            { n: '1', t: '多源抓取', d: '聚合公开信息与可信渠道，形成原始信号池。' },
            { n: '2', t: '事件去重', d: '合并重复叙事，沉淀为可跟踪的全局事件。' },
            { n: '3', t: 'Pulse Score 评分', d: '按新鲜度、可信度、热度、用户价值与来源覆盖加权排序。' },
            { n: '4', t: 'AI 判断生成', d: '输出发生了什么、为何重要、对你意味着什么与行动建议。' },
            { n: '5', t: '每周报告沉淀', d: '提炼主线、能力边界、工具机会与可忽略噪音。' },
          ].map((step) => (
            <li
              key={step.n}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#005bc1] font-headline text-sm font-black text-white">
                {step.n}
              </span>
              <div>
                <p className="font-headline font-bold text-slate-900">{step.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 rounded-3xl border border-slate-200 bg-[#f7f9fc] px-6 py-8 md:px-8">
        <h2 className="font-headline text-xl font-bold text-slate-900">我们帮你解决</h2>
        <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-700">
          <li className="flex gap-2">
            <span className="text-[#005bc1]">—</span>
            信息太多，不知道从哪看起
          </li>
          <li className="flex gap-2">
            <span className="text-[#005bc1]">—</span>
            不清楚哪些信号真的重要
          </li>
          <li className="flex gap-2">
            <span className="text-[#005bc1]">—</span>
            不知道该不该立刻试用新产品
          </li>
          <li className="flex gap-2">
            <span className="text-[#005bc1]">—</span>
            分不清热点与噪音，浪费时间
          </li>
        </ul>
      </section>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          to="/rankings"
          className="inline-flex justify-center rounded-full bg-[#005bc1] px-8 py-3 font-headline text-sm font-bold text-white shadow-md hover:bg-[#004a9e]"
        >
          查看今日榜单
        </Link>
        <Link
          to="/#subscribe"
          className="inline-flex justify-center rounded-full border-2 border-[#005bc1] bg-white px-8 py-3 font-headline text-sm font-bold text-[#005bc1] hover:bg-[#005bc1]/5"
        >
          订阅周报
        </Link>
      </div>
    </div>
  );
}
