import type { FormEvent, RefObject } from 'react';
import { Coffee } from 'lucide-react';

import { aboutBody, aboutCard } from './aboutStyles';

const participateSubCard =
  'flex h-full min-w-0 flex-col rounded-xl border border-[#D8E2F0] bg-slate-50/50 p-4 transition-[border-color,box-shadow,background-color] hover:border-[#BFD3FF] hover:bg-white hover:shadow-[0_2px_8px_rgba(37,99,235,0.06)]';

const btnPrimarySm =
  'mt-auto inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto';

type AboutParticipateSectionProps = {
  suggestFormRef: RefObject<HTMLElement | null>;
  content: string;
  contactEmail: string;
  contact: string;
  submitting: boolean;
  msg: { kind: 'ok' | 'err'; text: string } | null;
  wechatGroupEnabled: boolean;
  rewardEnabled: boolean;
  onContentChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onSubmitSuggest: (e: FormEvent) => void;
  onOpenWechatGroup: () => void;
  onOpenReward: () => void;
};

export function AboutParticipateSection({
  suggestFormRef,
  content,
  contactEmail,
  contact,
  submitting,
  msg,
  wechatGroupEnabled,
  rewardEnabled,
  onContentChange,
  onContactChange,
  onSubmitSuggest,
  onOpenWechatGroup,
  onOpenReward,
}: AboutParticipateSectionProps) {
  return (
    <div className="space-y-7 md:space-y-9">
      <section className={aboutCard} aria-labelledby="about-participate">
        <h2 id="about-participate" className="heading-section text-slate-900">
          一起参与 AI Pulse
        </h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2 md:items-stretch">
          <article className={participateSubCard}>
            <h3 className="font-headline text-[15px] font-semibold text-slate-900">加入微信交流群</h3>
            <p className={`mt-2 flex-1 ${aboutBody}`}>
              和关注 AI 工具、AI 产品、个人效率和创业机会的人一起交流。重要更新也会优先在群里同步。
            </p>
            <button
              type="button"
              className={btnPrimarySm}
              onClick={onOpenWechatGroup}
              disabled={!wechatGroupEnabled}
            >
              扫码添加微信
            </button>
          </article>

          <article className={participateSubCard}>
            <h3 className="font-headline text-[15px] font-semibold text-slate-900">联系合作</h3>
            <p className={`mt-2 flex-1 ${aboutBody}`}>
              信息源推荐、内容合作、产品合作或其他想法，欢迎通过邮箱联系。
            </p>
            <p className={`mt-auto pt-4 ${aboutBody}`}>
              <span className="text-slate-600">邮箱：</span>
              <a
                href={`mailto:${contactEmail}`}
                className="break-all font-medium text-[#2563EB] underline-offset-2 hover:underline"
              >
                {contactEmail}
              </a>
            </p>
          </article>
        </div>

        <section
          ref={suggestFormRef}
          className="mt-6 scroll-mt-20 border-t border-slate-100 pt-6"
          aria-labelledby="about-suggest-form"
        >
          <h3 id="about-suggest-form" className="font-headline text-lg font-bold text-slate-900">
            提交你的建议
          </h3>
          <p className={`mt-2 ${aboutBody}`}>
            产品建议、信息源推荐、错误反馈或合作想法都可以告诉我们。
          </p>
          <form onSubmit={onSubmitSuggest} className="mt-4 space-y-4">
            <div>
              <label htmlFor="suggest-content" className="block text-sm font-medium text-slate-700">
                建议内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="suggest-content"
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                rows={4}
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
                onChange={(e) => onContactChange(e.target.value)}
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
              className="btn-primary h-10 px-5 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? '提交中…' : '提交建议'}
            </button>
          </form>
        </section>
      </section>

      <section
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[#D8E2F0] bg-slate-50/60 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:gap-5 md:p-7"
        aria-labelledby="about-support"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <h2 id="about-support" className="font-headline text-base font-bold text-slate-900">
              支持作者
            </h2>
          </div>
          <p className={`mt-2 ${aboutBody}`}>
            如果 AI Pulse 对你有帮助，欢迎支持作者，你的支持是我维护和优化这个网站的重要动力。
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenReward}
          disabled={!rewardEnabled}
          className="btn-secondary w-full shrink-0 px-5 py-2 text-sm font-semibold sm:w-auto sm:self-center"
        >
          请作者喝杯咖啡
        </button>
      </section>
    </div>
  );
}
