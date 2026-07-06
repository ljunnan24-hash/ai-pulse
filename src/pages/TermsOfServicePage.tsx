import { Link } from 'react-router-dom';

import { Seo } from '../components/Seo';
import { contactEmail } from '../config';

const cardPlain =
  'rounded-[var(--radius-card)] border border-[#D8E2F0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-7';

export default function TermsOfServicePage() {
  const email = contactEmail();

  return (
    <div className="page-container pb-16 md:pb-20">
      <Seo
        title="服务条款 | AI Pulse"
        description="AI Pulse 服务条款，说明网站使用许可、内容边界、订阅和知识产权规则。"
        path="/terms"
      />
      <header className="mb-8 border-b border-[#E2E8F0] pb-6">
        <h1 className="heading-page">服务条款</h1>
        <p className="mt-3 text-sm text-slate-500">
          更新日期：<time dateTime="2026-05-07">2026 年 5 月 7 日</time>
        </p>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          欢迎使用 AI Pulse。以下条款约束您对本站及相关功能的使用。访问或使用本站，即表示您同意本条款；若不同意，请停止使用。
        </p>
      </header>

      <div className="space-y-8">
        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">一、服务说明</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            AI Pulse 是一款<strong className="font-medium text-slate-800"> AI 行业信息的整理与呈现产品</strong>
            ：我们从公开来源追踪动态，经去重与结构化后，以榜单、事件详情、周报等形式帮助您理解「发生了什么」「为什么值得看」「对你意味着什么」。服务内容可能随产品迭代调整，我们将在合理范围内更新本站说明。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">二、使用许可与行为规范</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            在您遵守本条款及相关法律的前提下，我们授予您一项<strong className="font-medium text-slate-800">个人的、非独占的、不可转让的</strong>
            许可，以访问和使用本站。您同意不得：对本站或相关系统进行逆向工程、爬虫滥用、干扰安全或负载；利用本站从事违法、侵权或欺诈活动；未经授权抓取大量数据用于竞争性服务或再分发。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">三、内容与 Pulse Score</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-slate-600">
            <li>
              本站展示的摘要、排序与标签基于<strong className="font-medium text-slate-800">公开信息与内部整理规则</strong>
              ，力求准确与可追溯，但<strong className="font-medium text-slate-800">不构成对事实完整性或时效性的保证</strong>
              。重要决策请以原始来源与专业意见为准。
            </li>
            <li>
              <strong className="text-slate-800">Pulse Score</strong>
              用于辅助排序与对照，反映新鲜度、热度、可信度与用户价值等维度的综合示意，
              <strong className="font-medium text-slate-800">
                不构成投资建议、采购结论、法律意见或职业与安全决策依据
              </strong>
              。
            </li>
            <li>
              外部链接由第三方运营，我们不对其内容、可用性或隐私做法负责；访问外链的风险由您自行承担。
            </li>
          </ul>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">四、订阅与邮箱</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            您在订阅周报时提供的邮箱及可选关键词，仅用于发送与管理周报内容，详见
            <Link to="/privacy" className="mx-1 font-medium text-[#2563EB] underline-offset-2 hover:underline">
              《隐私政策》
            </Link>
            。您应确保提供的联系方式真实有效；退订方式以邮件说明或本站指引为准。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">五、知识产权</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            本站界面设计、文案编排、数据结构与产品标识等受适用法律保护。未经书面许可，不得复制、修改或用于商业再分发。第三方来源内容的权利归各自权利人所有。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">六、免责声明</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            在法律允许的最大范围内，本站及服务按「现状」提供，不作任何明示或默示担保（包括对适销性、特定用途适用性或不侵权的保证）。因使用或无法使用本站而产生的<strong className="font-medium text-slate-800">
              间接、附带或惩罚性损害
            </strong>
            ，我们在法律法规允许的范围内不承担责任；我们的总体责任以您就争议服务已实际支付的金额为上限（若免费使用，则以合理范围为限）。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">七、服务变更与终止</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            我们可能因维护、合规或产品策略暂停或终止部分或全部功能，并将尽力通过本站公告等方式提示。您可随时停止使用本站。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">八、适用法律与争议解决</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            本条款的解释与争议解决，适用<strong className="font-medium text-slate-800">中华人民共和国大陆地区法律</strong>
            （为本条款之目的）。双方应先友好协商；协商不成的，可向<strong className="font-medium text-slate-800">有管辖权的人民法院</strong>
            提起诉讼（法律法规另有强制性规定的，从其规定）。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">九、条款变更</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            我们可能修订本条款并于本站公示更新日期。您在变更后继续使用本站，视为接受修订后的条款。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">十、联系我们</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            如您对本条款有疑问，请联系：
            <a
              href={`mailto:${email}`}
              className="ml-1 font-medium text-[#2563EB] underline-offset-2 hover:underline"
            >
              {email}
            </a>
          </p>
        </section>

        <p className="text-center text-sm text-slate-500">
          <Link to="/privacy" className="font-medium text-[#2563EB] underline-offset-2 hover:underline">
            查看隐私政策
          </Link>
          <span className="mx-2 text-slate-300">|</span>
          <Link to="/about" className="font-medium text-[#2563EB] underline-offset-2 hover:underline">
            返回关于我们
          </Link>
        </p>
      </div>
    </div>
  );
}
