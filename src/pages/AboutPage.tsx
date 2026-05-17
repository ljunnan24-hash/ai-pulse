import type { FormEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CalendarDays, FileText, Layers2 } from 'lucide-react';

import { AboutParticipateSection } from '../components/about/AboutParticipateSection';
import { AboutQrModal } from '../components/about/AboutQrModal';
import { aboutBody, aboutCard } from '../components/about/aboutStyles';
import { apiBase } from '../config';
import { getVisitorId } from '../lib/analytics';

const aboutBodyStack = `mt-3 space-y-3 ${aboutBody}`;

const tagCls =
  'inline-flex items-center rounded-full border border-[#D8E2F0] bg-white px-3 py-1 text-[13px] font-medium text-slate-600';

const boundaryCard =
  'rounded-[var(--radius-card)] border border-[#D8E2F0] border-l-4 border-l-amber-300/90 bg-white p-7 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-8';

const audienceList = `${aboutBody} mt-3 space-y-1.5`;

const WECHAT_GROUP_QR_SRC = '/wechat-group-qrcode.png';
const REWARD_QR_SRC = '/reward-author-qrcode.png';

function MiniIcon({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-slate-500">{children}</span>;
}

type QrModalKind = 'wechat-group' | 'reward' | null;

const PIPELINE_STEPS = [
  { n: '01', title: '收集', body: '持续追踪公开来源中的 AI 行业动态。' },
  { n: '02', title: '去重', body: '把多个来源报道的同一事件合并，减少重复阅读。' },
  { n: '03', title: '整理', body: '统一整理成「发生了什么」「为什么值得看」「对你意味着什么」。' },
  { n: '04', title: '排序', body: '结合新鲜度、热度、可信度和用户价值，生成 Pulse Score。' },
  { n: '05', title: '输出', body: '形成每日榜单、事件详情、能力边界和每周周报。' },
] as const;

const SEE_CARDS = [
  { icon: CalendarDays, title: '每日榜单', body: '每天快速看到最值得关注的 AI 行业动态。' },
  { icon: FileText, title: '事件详情', body: '理解一件事情的背景、价值和可能影响。' },
  { icon: Layers2, title: '每周周报', body: '把一周内的重要事件收敛成 Top3、能力边界和术语解释。' },
  { icon: Archive, title: '历史归档', body: '保留过往榜单和周报，方便回看。' },
] as const;

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
    <div>
      <div className="page-container pb-14 md:pb-16">
        <div className="space-y-7 md:space-y-9">
          <section className={aboutCard} aria-labelledby="about-what">
            <h1 id="about-what" className="heading-section text-slate-900">
              AI Pulse 是什么
            </h1>
            <div className={aboutBodyStack}>
              <p>AI Pulse 是一个面向普通用户、小团队和创业者的 AI 信号筛选产品。</p>
              <p>
                我们把公开来源中的 AI 动态整理成清楚的事件，并提供轻量判断，帮助你快速理解：发生了什么、为什么值得看、对你意味着什么。
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={tagCls}>AI 信号整理</span>
              <span className={tagCls}>事件去重</span>
              <span className={tagCls}>价值判断</span>
              <span className={tagCls}>周报归档</span>
            </div>
          </section>

          <section className={aboutCard} aria-labelledby="about-why">
            <h2 id="about-why" className="heading-section text-slate-900">
              我们为什么做 AI Pulse
            </h2>
            <div className={aboutBodyStack}>
              <p>AI 行业变化很快，但真正值得持续关注的信号，并没有想象中那么多。</p>
              <p>
                今天的问题不是信息太少，而是信息太散、太重复、太缺少判断。用户看了很多 AI 新闻，却仍然不知道哪些值得关注，哪些可以忽略。
              </p>
              <p>
                AI Pulse 希望把分散的信息整理成清楚的事件，再提供克制、轻量的判断，帮助用户用更少时间看清 AI 行业真正重要的变化。
              </p>
            </div>
          </section>

          <section className={aboutCard} aria-labelledby="about-pipeline">
            <h2 id="about-pipeline" className="heading-section text-slate-900">
              从信息到判断，AI Pulse 做了什么
            </h2>
            <ol className="mt-4 space-y-0">
              {PIPELINE_STEPS.map((step) => (
                <li
                  key={step.n}
                  className="flex gap-3 border-b border-slate-100 py-2.5 last:border-b-0 last:pb-0"
                >
                  <span className="w-8 shrink-0 pt-px font-mono text-[13px] font-semibold tabular-nums text-slate-400">
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <p className="font-headline text-[15px] font-semibold leading-snug text-slate-900">
                      {step.title}
                    </p>
                    <p className={`mt-0.5 ${aboutBody}`}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="about-see">
            <h2 id="about-see" className="heading-section mb-4 text-slate-900">
              你可以在 AI Pulse 看到什么
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {SEE_CARDS.map(({ icon: Icon, title, body }) => (
                <article key={title} className={`${aboutCard} flex gap-3 md:flex-col md:gap-2`}>
                  <MiniIcon>
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </MiniIcon>
                  <div>
                    <h3 className="font-headline text-[15px] font-semibold text-slate-900">{title}</h3>
                    <p className={`mt-1.5 ${aboutBody}`}>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={boundaryCard} aria-labelledby="about-not">
            <h2 id="about-not" className="heading-section text-slate-900">
              我们的边界
            </h2>
            <ul className={`${audienceList} list-none`}>
              {[
                '我们不追求全网资讯搬运。',
                '我们不追逐夸张标题和情绪化结论。',
                '我们不替用户做投资、职业或安全决策。',
                'Pulse Score 只是排序和判断参考，不代表绝对价值。',
              ].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="grid gap-3 md:grid-cols-2 md:items-start" aria-label="适合与不适合">
            <div className={aboutCard}>
              <h2 className="font-headline text-lg font-bold text-slate-900">适合谁</h2>
              <ul className={audienceList}>
                <li>需要快速了解 AI 行业变化的人。</li>
                <li>想用 AI 辅助产品、创业、内容或开发决策的人。</li>
                <li>希望减少信息噪音，只看结构化判断的人。</li>
              </ul>
            </div>
            <div className={aboutCard}>
              <h2 className="font-headline text-lg font-bold text-slate-900">不适合谁</h2>
              <ul className={audienceList}>
                <li>需要毫秒级实时新闻推送的人。</li>
                <li>希望获得投资、法律或职业决策结论的人。</li>
                <li>只想浏览未经整理的原始信息流的人。</li>
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

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
            <Link to="/rankings" className="btn-primary-lg px-6 text-center no-underline md:px-8">
              查看今日榜单
            </Link>
            <Link to="/weekly/latest" className="btn-secondary px-6 text-center no-underline md:px-8">
              阅读本周周报
            </Link>
          </div>
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
