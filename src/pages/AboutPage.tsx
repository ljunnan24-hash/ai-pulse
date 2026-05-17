import type { FormEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CalendarDays, FileText, Layers2 } from 'lucide-react';

import { AboutParticipateSection } from '../components/about/AboutParticipateSection';
import { AboutQrModal } from '../components/about/AboutQrModal';
import { apiBase } from '../config';
import { getVisitorId } from '../lib/analytics';

/** 关于页统一：白卡、细边框、轻阴影（与全站浅灰蓝画布一致） */
const cardPlain =
  'rounded-[var(--radius-card)] border border-[#D8E2F0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-7';

const tagCls =
  'inline-flex items-center rounded-full border border-[#D8E2F0] bg-white px-3 py-1 text-[13px] font-medium text-slate-600';

/** 静态资源：`public/wechat-group-qrcode.png`（微信交流群） */
const WECHAT_GROUP_QR_SRC = '/wechat-group-qrcode.png';
/** 静态资源：`public/reward-author-qrcode.png`（打赏）；未部署时弹窗内图片会 404 */
const REWARD_QR_SRC = '/reward-author-qrcode.png';


function MiniIcon({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-slate-500">{children}</span>;
}

type QrModalKind = 'wechat-group' | 'reward' | null;

export default function AboutPage() {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [qrModal, setQrModal] = useState<QrModalKind>(null);
  const suggestFormRef = useRef<HTMLElement>(null);

  function scrollToSuggestForm() {
    suggestFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

        {/* 二、我们为什么做 AI Pulse */}
        <section className={cardPlain} aria-labelledby="about-why">
          <h2 id="about-why" className="heading-section text-slate-900">
            我们为什么做 AI Pulse
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 md:text-[15px] md:leading-[1.75]">
            <p>
              AI 行业变化很快，但真正值得普通用户、小团队和创业者关注的信号，并没有那么多。
            </p>
            <p>
              今天的问题不是信息太少，而是信息太散、太重复、太缺少判断。用户看了很多 AI 新闻，却仍然不知道哪些值得关注，哪些可以忽略。
            </p>
            <p>
              AI Pulse 希望把分散的信息整理成清楚的事件，再提供克制、轻量的判断，帮助用户用更少时间看清 AI 行业真正重要的变化。
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

        <AboutParticipateSection
          suggestFormRef={suggestFormRef}
          content={content}
          contact={contact}
          submitting={submitting}
          msg={msg}
          onContentChange={setContent}
          onContactChange={setContact}
          onSubmitSuggest={onSubmitSuggest}
          onOpenWechatGroup={() => setQrModal('wechat-group')}
          onOpenReward={() => setQrModal('reward')}
          onScrollToSuggestForm={scrollToSuggestForm}
        />

        {/* 九、底部 CTA */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Link to="/rankings" className="btn-primary-lg px-6 text-center no-underline md:px-8">
            查看今日榜单
          </Link>
          <Link to="/weekly/latest" className="btn-secondary px-6 text-center no-underline md:px-8">
            阅读本周周报
          </Link>
        </div>
      </div>

      <AboutQrModal
        open={qrModal === 'wechat-group'}
        title="加入微信交流群"
        description="扫码添加微信，备注「AI Pulse」，邀请你加入交流群。"
        imageSrc={WECHAT_GROUP_QR_SRC}
        imageAlt="AI Pulse 微信交流群二维码"
        onClose={() => setQrModal(null)}
      />
      <AboutQrModal
        open={qrModal === 'reward'}
        title="支持作者"
        description="微信扫码，自愿支持作者持续维护 AI Pulse。"
        imageSrc={REWARD_QR_SRC}
        imageAlt="微信打赏二维码"
        onClose={() => setQrModal(null)}
      />
    </div>
  );
}
