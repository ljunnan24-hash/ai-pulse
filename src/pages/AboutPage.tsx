import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl pb-20 pt-8">
      <h1 className="font-headline text-4xl font-extrabold text-slate-900">关于 AI Pulse</h1>
      <p className="mt-6 leading-relaxed text-slate-700">
        AI Pulse 是一套面向<strong className="text-slate-900">非技术职场人、创业者与小团队</strong>
        的 AI 信号产品：每日通过多源数据聚合与 Pulse Score，帮你快速看到当天最值得关注的动态；每周再以「判断报告」的形式，告诉你
        <strong className="text-slate-900">什么值得投入时间、什么可以先观望、哪些只是噪音</strong>。
      </p>
      <p className="mt-4 leading-relaxed text-slate-700">
        我们不是资讯站，而是围绕<strong className="text-slate-900">评分、判断与行动建议</strong>
        组织信息，节省你的注意力。
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          to="/rankings"
          className="rounded-full bg-[#005bc1] px-6 py-3 font-headline text-sm font-bold text-white shadow-sm"
        >
          查看今日榜单
        </Link>
        <Link to="/#subscribe" className="rounded-full border border-slate-300 bg-white px-6 py-3 font-headline text-sm font-bold text-[#005bc1]">
          订阅周报
        </Link>
      </div>
    </div>
  );
}
