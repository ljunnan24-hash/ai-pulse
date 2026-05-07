import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** 首页「信息质量」三列工作流（极简 / Apple 式留白） */

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#2563EB" strokeWidth="1.5" aria-hidden>
      <path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z" strokeLinejoin="round" />
      <path d="M4 9V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" strokeLinecap="round" />
      <path d="M9 13h6" strokeLinecap="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#2563EB" strokeWidth="1.5" aria-hidden>
      <path d="M12 3l8 3v6.5c0 4.5-3.2 8.7-8 9.5-4.8-.8-8-5-8-9.5V6l8-3z" strokeLinejoin="round" />
      <path d="M9.5 12.5l1.7 1.7 3.3-3.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#2563EB" strokeWidth="1.5" aria-hidden>
      <path d="M7 4h6l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      <path d="M13 4v4h4M9 13h6M9 17h6" strokeLinecap="round" />
    </svg>
  );
}

function IconFooterShield() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#2563EB]" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3l8 3v6.5c0 4.5-3.2 8.7-8 9.5-4.8-.8-8-5-8-9.5V6l8-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Step = { num: string; title: string; body: string };

type Column = {
  pill: string;
  icon: ReactNode;
  heading: string;
  steps: Step[];
};

const COLUMNS: Column[] = [
  {
    pill: '信息输入',
    icon: <IconInbox />,
    heading: '收集与整理原始信息',
    steps: [
      {
        num: '01',
        title: '多源采集',
        body: '追踪官方公告、AI 媒体、GitHub、产品平台与社区信号，扩大信息覆盖面。',
      },
      {
        num: '02',
        title: '事件合并与去重',
        body: '将多个来源中描述同一事实的信息合并为一个事件，减少重复阅读。',
      },
    ],
  },
  {
    pill: '质量处理',
    icon: <IconShield />,
    heading: '核验与多维分析',
    steps: [
      {
        num: '01',
        title: '事实校验',
        body: '优先核对官方来源与原始链接，区分事实、媒体解读和社区讨论。',
      },
      {
        num: '02',
        title: '多 Agent 分析',
        body: '不同 Agent 分别处理价值解释、噪音识别、能力边界、趋势归纳和术语说明。',
      },
      {
        num: '03',
        title: 'Pulse Score 排序',
        body: '结合新鲜度、可信度、热度与用户价值，对每日信息进行排序参考。',
      },
    ],
  },
  {
    pill: '内容输出',
    icon: <IconDocument />,
    heading: '输出高质量结果',
    steps: [
      {
        num: '01',
        title: '每日信息榜单',
        body: '帮助用户先看到最值得看的 AI 信息。',
      },
      {
        num: '02',
        title: '每周 AI 信号简报',
        body: '按周整理关键变化、工具线索、噪音信息与术语背景。',
      },
      {
        num: '03',
        title: '质量审核',
        body: '在输出前检查结构完整性、事实风险和可读性。',
      },
    ],
  },
];

function FlowConnector() {
  return (
    <div
      className="hidden shrink-0 items-center self-center lg:flex lg:w-12 lg:flex-col lg:justify-center xl:w-14"
      aria-hidden
    >
      <div className="flex w-full items-center justify-center">
        <span className="h-px w-2 flex-1 border-t border-dashed border-[#BFDBFE]" />
        <span className="mx-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-[#DBEAFE] bg-white text-[#2563EB]">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <span className="h-px w-2 flex-1 border-t border-dashed border-[#BFDBFE]" />
      </div>
    </div>
  );
}

function StepBlock({ step, isFirst }: { step: Step; isFirst: boolean }) {
  return (
    <div className={`border-t border-[#E5ECF5] pt-5 ${isFirst ? 'border-t-0 pt-0' : ''}`}>
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#BFDBFE] bg-[#F8FAFC] text-[13px] font-bold tabular-nums text-[#2563EB]">
          {step.num}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[16px] font-extrabold text-[#0F172A]">{step.title}</h4>
          <p className="mt-2 text-[14px] leading-[1.8] text-[#64748B] md:text-[15px]">{step.body}</p>
        </div>
      </div>
    </div>
  );
}

function QualityColumn({ column }: { column: Column }) {
  return (
    <article className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-[#D8E2F0] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8 lg:min-h-[540px]">
      <div className="flex flex-col items-center text-center">
        <span className="rounded-full border border-[#BFDBFE] bg-[#F8FAFC] px-3 py-1.5 text-[13px] font-bold text-[#2563EB]">
          {column.pill}
        </span>
        <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5ECF5] bg-white">
          {column.icon}
        </div>
        <h3 className="mt-5 max-w-[18rem] font-headline text-[20px] font-extrabold leading-snug text-[#0F172A] md:text-[21px]">
          {column.heading}
        </h3>
      </div>
      <div className="mt-8 flex flex-col">
        {column.steps.map((step, i) => (
          <StepBlock key={step.num} step={step} isFirst={i === 0} />
        ))}
      </div>
    </article>
  );
}

export function InformationQualityWorkflow() {
  return (
    <section className="mb-[72px]">
      <h2 className="font-headline text-[30px] font-extrabold leading-[1.2] text-[#0F172A] md:text-[32px]">
        AI Pulse 如何保证信息质量
      </h2>
      <p className="mt-3 max-w-[52rem] text-[15px] leading-[1.8] text-[#64748B] md:text-[16px]">
        从多源采集到多 Agent 分析，AI Pulse 会先整理事实，再补充解释与排序，最后输出每日榜单和每周 AI 信号简报。
      </p>

      <div className="mt-10 flex flex-col gap-8 lg:mt-12 lg:flex-row lg:items-stretch lg:gap-0 lg:gap-x-0">
        <QualityColumn column={COLUMNS[0]} />
        <FlowConnector />
        <QualityColumn column={COLUMNS[1]} />
        <FlowConnector />
        <QualityColumn column={COLUMNS[2]} />
      </div>

      <div className="mt-10 flex justify-center md:mt-12">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#D8E2F0] bg-white px-4 py-2.5 text-[13px] font-medium leading-snug text-[#64748B] shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:px-5 md:text-sm">
          <IconFooterShield />
          <span>全流程质量把控，只为输出更值得信赖的 AI 信息。</span>
        </div>
      </div>
    </section>
  );
}
