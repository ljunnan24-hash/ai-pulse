import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { AboutParticipateSection } from '../components/about/AboutParticipateSection';
import { AboutQrModal } from '../components/about/AboutQrModal';
import { aboutBody, aboutCard } from '../components/about/aboutStyles';
import { apiBase } from '../config';
import { getVisitorId } from '../lib/analytics';

const aboutBodyStack = `mt-3 space-y-3 ${aboutBody}`;

const tagCls =
  'inline-flex items-center rounded-full border border-[#D8E2F0] bg-white px-3 py-1 text-[13px] font-medium text-slate-600';

const WECHAT_GROUP_QR_SRC = '/wechat-group-qrcode.png';
const REWARD_QR_SRC = '/reward-author-qrcode.png';

type QrModalKind = 'wechat-group' | 'reward' | null;

const PIPELINE_STEPS = [
  { n: '01', title: '收集', body: '持续追踪公开来源中的 AI 行业动态。' },
  { n: '02', title: '去重', body: '把多个来源报道的同一事件合并，减少重复阅读。' },
  { n: '03', title: '整理', body: '统一整理成「发生了什么」「为什么值得看」「对你意味着什么」。' },
  { n: '04', title: '排序', body: '结合新鲜度、热度、可信度和用户价值，生成 Pulse Score。' },
  { n: '05', title: '输出', body: '形成每日榜单、事件详情、能力边界和每周周报。' },
] as const;

export default function AboutPage() {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [qrModal, setQrModal] = useState<QrModalKind>(null);
  const suggestFormRef = useRef<HTMLElement>(null);

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
              <p>
                AI Pulse 是一个面向 AI 产品人、独立开发者、小团队和 AI 机会关注者的信号筛选产品。
              </p>
              <p>
                我们持续追踪公开来源中的 AI 行业变化，把分散、重复、夸张的信息整理成清楚的事件，并提供克制、轻量的判断，帮助你快速理解：发生了什么、为什么重要、是否值得行动。
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
              <p>
                AI 行业发展迅速。每天都有新模型、新产品、新融资和新观点出现，但真正值得持续关注的变化，并没有那么多。
              </p>
              <p>
                对产品人、创业者和小团队来说，最大的困难不是找不到 AI 信息，而是很难判断哪些信息真的重要，哪些只是短暂的热闹。
              </p>
              <p>
                AI Pulse 持续追踪行业变化，致力于筛选出真正重要的信号，帮你减少无效阅读。我们想保护的，不只是你的时间，还有你的注意力。
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
