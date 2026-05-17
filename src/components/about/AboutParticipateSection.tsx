import type { FormEvent, RefObject } from 'react';
import { Coffee } from 'lucide-react';

const cardPlain =
  'rounded-[var(--radius-card)] border border-[#D8E2F0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-7';

const participateSubCard =
  'flex h-full min-w-0 flex-col rounded-xl border border-[#D8E2F0] bg-slate-50/50 p-4 transition-[border-color,box-shadow,background-color] hover:border-[#BFD3FF] hover:bg-white hover:shadow-[0_2px_8px_rgba(37,99,235,0.06)]';

const btnPrimarySm =
  'mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0052cc] sm:w-auto';

const btnOutlineSm =
  'mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#BFD3FF] bg-white px-4 text-sm font-semibold text-[#1463FF] transition-colors hover:bg-[#F8FAFF] sm:w-auto';

const CONTACT_EMAIL = '2089128910@qq.com';

type AboutParticipateSectionProps = {
  suggestFormRef: RefObject<HTMLElement | null>;
  content: string;
  contact: string;
  submitting: boolean;
  msg: { kind: 'ok' | 'err'; text: string } | null;
  onContentChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onSubmitSuggest: (e: FormEvent) => void;
  onOpenWechatGroup: () => void;
  onOpenReward: () => void;
  onScrollToSuggestForm: () => void;
};

export function AboutParticipateSection({
  suggestFormRef,
  content,
  contact,
  submitting,
  msg,
  onContentChange,
  onContactChange,
  onSubmitSuggest,
  onOpenWechatGroup,
  onOpenReward,
  onScrollToSuggestForm,
}: AboutParticipateSectionProps) {
  return (
    <div className="space-y-5">
      <section className={cardPlain} aria-labelledby="about-participate">
        <h2 id="about-participate" className="heading-section text-slate-900">
          一起参与 AI Pulse
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-[15px] md:leading-[1.75]">
          AI Pulse 还在持续迭代中。我们希望它不只是一个 AI 信息页面，而是一个由真实用户共同参与、持续校准的 AI
          信号系统。
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className={participateSubCard}>
            <h3 className="font-headline text-[15px] font-semibold text-slate-900">加入微信交流群</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              和关注 AI 工具、AI 产品、个人效率和创业机会的人一起交流。我们也会在群里分享重要更新和产品迭代。
            </p>
            <button type="button" className={btnPrimarySm} onClick={onOpenWechatGroup}>
              扫码加入
            </button>
          </article>

          <article className={participateSubCard}>
            <h3 className="font-headline text-[15px] font-semibold text-slate-900">给 AI Pulse 提建议</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              如果你发现信息源、分类、判断方式或页面体验有问题，欢迎告诉我们。每一条反馈都会帮助 AI Pulse
              变得更准确。
            </p>
            <button type="button" className={btnOutlineSm} onClick={onScrollToSuggestForm}>
              提交建议
            </button>
          </article>

          <article className={participateSubCard}>
            <h3 className="font-headline text-[15px] font-semibold text-slate-900">联系合作</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
              如果你有信息源推荐、内容合作、产品合作或其他想法，可以通过邮箱联系我们。
            </p>
            <p className="mt-4 text-sm text-slate-600">
              <span className="text-slate-500">邮箱：</span>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="break-all font-medium text-[#2563EB] underline-offset-2 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </article>
        </div>

        <section
          ref={suggestFormRef}
          className="mt-8 scroll-mt-20 border-t border-slate-100 pt-8"
          aria-labelledby="about-suggest-form"
        >
          <h3 id="about-suggest-form" className="font-headline text-lg font-bold text-slate-900">
            提交你的建议
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            产品建议、信息源推荐、错误反馈或合作想法都可以告诉我们。
          </p>
          <form onSubmit={onSubmitSuggest} className="mt-5 space-y-4">
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
        className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[#D8E2F0] bg-slate-50/60 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-6"
        aria-labelledby="about-support"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <h2 id="about-support" className="font-headline text-base font-bold text-slate-900">
              支持作者
            </h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            如果 AI Pulse 对你有帮助，也欢迎自愿支持作者持续维护和优化这个产品。
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenReward}
          className="btn-secondary shrink-0 px-5 py-2 text-sm font-semibold sm:self-center"
        >
          请作者喝杯咖啡
        </button>
      </section>
    </div>
  );
}
