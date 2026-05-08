import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CalendarDays, FileText, Heart, Layers2 } from 'lucide-react';

import { apiBase } from '../config';
import { getVisitorId } from '../lib/analytics';

/** 关于页统一：白卡、细边框、轻阴影（与全站浅灰蓝画布一致） */
const cardPlain =
  'rounded-[var(--radius-card)] border border-[#D8E2F0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-7';

const tagCls =
  'inline-flex items-center rounded-full border border-[#D8E2F0] bg-white px-3 py-1 text-[13px] font-medium text-slate-600';

/** 静态资源路径：`public/reward-author-qrcode.png`；未部署该文件时请把开关改为 false，仅保留文案 */
const SHOW_REWARD_QR = true;
const REWARD_QR_SRC = '/reward-author-qrcode.png';

function MiniIcon({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-slate-500">{children}</span>;
}

export default function AboutPage() {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmitSuggest(e: FormEvent) {
    e.preventDefault();
    const c = content.trim();
    if (c.length < 5) {
      setMsg({ kind: 'err', text: '请至少填写 5 个字的建议内容。' });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase()}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          content: c,
          contact: contact.trim() || undefined,
          source_page: '/about',
          visitor_id: getVisitorId(),
        }),
      });
      if (res.status === 429) {
        setMsg({ kind: 'err', text: '提交过于频繁，请稍后再试。' });
        return;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `HTTP ${res.status}`);
      }
      setMsg({ kind: 'ok', text: '感谢你的反馈，我们会认真查看。' });
      setContent('');
      setContact('');
    } catch {
      setMsg({ kind: 'err', text: '提交失败，请稍后再试。' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container pb-16 md:pb-20">
      <div className="space-y-8 md:space-y-10">
        {/* 一、Hero — 与其它章节同一白卡样式 */}
        <section className={cardPlain} aria-labelledby="about-what">
          <h1 id="about-what" className="heading-section text-slate-900">
            AI Pulse 是什么
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-[15px] md:leading-[1.75]">
            AI Pulse 是一款 AI 信息整理产品。我们持续追踪公开来源中的 AI 行业动态，先去重、整理和结构化信息，再帮助用户快速理解「发生了什么」「为什么值得看」「对你意味着什么」。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className={tagCls}>AI 信息整理</span>
            <span className={tagCls}>事件去重</span>
            <span className={tagCls}>价值判断</span>
            <span className={tagCls}>周报归档</span>
          </div>
        </section>

        {/* 二、我们为什么做这个产品 */}
        <section className={cardPlain} aria-labelledby="about-why">
          <h2 id="about-why" className="heading-section text-slate-900">
            我们为什么做这个产品
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 md:text-[15px] md:leading-[1.75]">
            <p>
              AI 行业的信息更新很快，但真正值得普通用户、小团队和创业者关注的变化并不多。
            </p>
            <p>
              问题不只是信息太多，而是信息经常重复、来源分散、标题夸张、上下文不足。AI Pulse 希望把这些信息先整理成更清楚的事件，再提供轻量判断，帮助用户减少无效阅读。
            </p>
          </div>
        </section>

        {/* 三、AI Pulse 如何处理信息 */}
        <section className={cardPlain} aria-labelledby="about-pipeline">
          <h2 id="about-pipeline" className="heading-section text-slate-900">
            AI Pulse 如何处理信息
          </h2>
          <ol className="mt-5 space-y-4">
            {[
              { n: '01', title: '收集', body: '持续追踪公开来源中的 AI 行业动态。' },
              { n: '02', title: '去重', body: '把多个来源报道的同一事件合并，减少重复阅读。' },
              {
                n: '03',
                title: '整理',
                body: '把信息拆成「发生了什么」「为什么值得看」「对你意味着什么」。',
              },
              {
                n: '04',
                title: '排序',
                body: '结合新鲜度、热度、可信度和用户价值，生成 Pulse Score。',
              },
              {
                n: '05',
                title: '输出',
                body: '形成每日榜单、事件详情、能力边界和每周周报。',
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-3 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                <span className="w-9 shrink-0 pt-0.5 font-mono text-[13px] font-semibold tabular-nums text-slate-400">
                  {step.n}
                </span>
                <div className="min-w-0">
                  <p className="font-headline text-[15px] font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 四、你可以在 AI Pulse 看到什么 */}
        <section aria-labelledby="about-see">
          <h2 id="about-see" className="heading-section mb-5 text-slate-900">
            你可以在 AI Pulse 看到什么
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className={`${cardPlain} flex gap-3 md:flex-col md:gap-3`}>
              <MiniIcon>
                <CalendarDays className="h-4 w-4" strokeWidth={2} aria-hidden />
              </MiniIcon>
              <div>
                <h3 className="font-headline text-[15px] font-semibold text-slate-900">每日榜单</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">每天整理值得关注的 AI 行业动态。</p>
              </div>
            </article>
            <article className={`${cardPlain} flex gap-3 md:flex-col md:gap-3`}>
              <MiniIcon>
                <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
              </MiniIcon>
              <div>
                <h3 className="font-headline text-[15px] font-semibold text-slate-900">事件详情</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  解释单个事件的背景、价值和可能影响。
                </p>
              </div>
            </article>
            <article className={`${cardPlain} flex gap-3 md:flex-col md:gap-3`}>
              <MiniIcon>
                <Layers2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              </MiniIcon>
              <div>
                <h3 className="font-headline text-[15px] font-semibold text-slate-900">每周周报</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  把一周内的重要事件收敛成判断、Top3、能力边界和术语解释。
                </p>
              </div>
            </article>
            <article className={`${cardPlain} flex gap-3 md:flex-col md:gap-3`}>
              <MiniIcon>
                <Archive className="h-4 w-4" strokeWidth={2} aria-hidden />
              </MiniIcon>
              <div>
                <h3 className="font-headline text-[15px] font-semibold text-slate-900">历史归档</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  保留过往榜单和周报，方便回看。
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* 五、我们不做什么 */}
        <section
          className="rounded-[var(--radius-card)] border border-orange-100/90 bg-orange-50/50 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] md:p-7"
          aria-labelledby="about-not"
        >
          <h2 id="about-not" className="font-headline text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            我们不做什么
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">·</span>
              我们不追求全网资讯搬运。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">·</span>
              我们不把未经核实的信息包装成确定结论。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">·</span>
              我们不替用户做投资、职业或安全决策。
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-slate-400">·</span>
              Pulse Score 只是排序和判断参考，不代表绝对价值。
            </li>
          </ul>
        </section>

        {/* 六、适合谁 / 不适合谁 */}
        <section className="grid gap-4 md:grid-cols-2" aria-label="适合与不适合">
          <div className={cardPlain}>
            <h2 className="font-headline text-lg font-bold text-slate-900">适合谁</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                需要快速了解 AI 行业变化的人。
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                想用 AI 辅助产品、创业、内容或开发决策的人。
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                希望减少信息噪音，只看结构化判断的人。
              </li>
            </ul>
          </div>
          <div className={cardPlain}>
            <h2 className="font-headline text-lg font-bold text-slate-900">不适合谁</h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                需要毫秒级实时新闻推送的人。
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                希望获得投资、法律或职业决策结论的人。
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                只想浏览未经整理的原始信息流的人。
              </li>
            </ul>
          </div>
        </section>

        {/* 七、联系我们 */}
        <section className={cardPlain} aria-labelledby="about-contact">
          <h2 id="about-contact" className="heading-section text-slate-900">
            联系我们
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-[15px] md:leading-relaxed">
            如果你对 AI Pulse 有建议、反馈、合作想法，或希望推荐信息源，可以通过邮箱联系我们。
          </p>
          <p className="mt-4 text-sm text-slate-600">
            <span className="mr-1">邮箱：</span>
            <a
              href="mailto:2089128910@qq.com"
              className="break-all font-medium text-[#2563EB] underline-offset-2 hover:underline"
            >
              2089128910@qq.com
            </a>
          </p>
        </section>

        {/* 八、打赏作者 */}
        <section className={cardPlain} aria-labelledby="about-reward">
          <div
            className={
              SHOW_REWARD_QR ? 'flex flex-col gap-5 sm:flex-row sm:gap-6' : 'flex flex-col'
            }
          >
            <div className="min-w-0 flex-1">
              <div className="flex gap-3">
                <MiniIcon>
                  <Heart className="h-4 w-4" strokeWidth={2} aria-hidden />
                </MiniIcon>
                <h2 id="about-reward" className="heading-section text-slate-900">
                  打赏作者
                </h2>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 md:text-[15px] md:leading-[1.75]">
                <p>如果 AI Pulse 对你有帮助，欢迎打赏支持作者。</p>
                <p>你的认可是我持续维护、优化和更新这个网站的重要动力。</p>
              </div>
            </div>
            {SHOW_REWARD_QR ? (
              <div className="flex shrink-0 flex-col items-center sm:items-end sm:pt-1">
                <img
                  src={REWARD_QR_SRC}
                  alt="微信、支付宝打赏二维码"
                  width={140}
                  height={140}
                  loading="lazy"
                  decoding="async"
                  className="h-[140px] w-[140px] rounded-lg border border-[#E8EDF5] bg-white object-contain p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                />
                <p className="mt-2 text-center text-[13px] text-slate-500 sm:text-right">微信 / 支付宝打赏</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* 九、给 AI Pulse 提建议 */}
        <section className={cardPlain} aria-labelledby="about-suggest">
          <h2 id="about-suggest" className="heading-section text-slate-900">
            给 AI Pulse 提建议
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-[15px] md:leading-relaxed">
            如果你有产品建议、信息源推荐、错误反馈或合作想法，欢迎告诉我们。
          </p>
          <form onSubmit={onSubmitSuggest} className="mt-5 space-y-4">
            <div>
              <label htmlFor="suggest-content" className="block text-sm font-medium text-slate-700">
                建议内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="suggest-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={1000}
                placeholder="至少 5 个字，最多 1000 字"
                className="mt-2 w-full rounded-xl border border-[#D8E2F0] bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-offset-2 focus:border-[#94A3B8] focus:ring-2 focus:ring-[#1463FF]/20"
              />
            </div>
            <div>
              <label htmlFor="suggest-contact" className="block text-sm font-medium text-slate-700">
                联系方式（选填）
              </label>
              <input
                id="suggest-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={120}
                placeholder="邮箱或微信号，便于我们必要时回复"
                className="mt-2 w-full rounded-xl border border-[#D8E2F0] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[#94A3B8] focus:ring-2 focus:ring-[#1463FF]/20"
              />
            </div>
            {msg ? (
              <p
                className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}
                role="status"
              >
                {msg.text}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? '提交中…' : '提交建议'}
            </button>
          </form>
        </section>

        {/* 十、底部 CTA */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Link to="/rankings" className="btn-primary-lg px-6 text-center no-underline md:px-8">
            查看今日榜单
          </Link>
          <Link to="/weekly/latest" className="btn-secondary px-6 text-center no-underline md:px-8">
            阅读本周周报
          </Link>
        </div>
      </div>
    </div>
  );
}
