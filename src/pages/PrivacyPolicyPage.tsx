import { Link } from 'react-router-dom';

import { contactEmail } from '../config';

const cardPlain =
  'rounded-[var(--radius-card)] border border-[#D8E2F0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] md:p-7';

export default function PrivacyPolicyPage() {
  const email = contactEmail();

  return (
    <div className="page-container pb-16 md:pb-20">
      <header className="mb-8 border-b border-[#E2E8F0] pb-6">
        <h1 className="heading-page">隐私政策</h1>
        <p className="mt-3 text-sm text-slate-500">
          更新日期：<time dateTime="2026-05-07">2026 年 5 月 7 日</time>
        </p>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-slate-600">
          AI Pulse（「我们」）重视您的隐私。本政策说明在您访问本站或使用订阅等功能时，我们如何收集、使用与保护个人信息。使用服务即表示您已阅读并理解本政策。
        </p>
      </header>

      <div className="space-y-8">
        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">一、适用范围</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            本政策适用于您通过 AI Pulse 网站（以下称「本站」）访问排行榜、事件详情、周报、归档以及邮箱订阅等相关功能时涉及的个人信息处理活动。若本站链接至第三方网站或服务，请以该第三方的隐私政策为准。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">二、我们收集的信息</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
            <li>
              <strong className="text-slate-800">您主动提供的信息：</strong>
              例如在「订阅周报」中提交的<strong className="font-medium text-slate-800">电子邮箱地址</strong>
              ，以及您自愿填写的<strong className="font-medium text-slate-800">兴趣关键词</strong>（最多 3 个），用于向您发送或个性化周报相关内容。
            </li>
            <li>
              <strong className="text-slate-800">技术与使用信息：</strong>
              为保障服务运行与安全，服务器可能记录与您访问相关的<strong className="font-medium text-slate-800">
                浏览器类型、大致访问时间、请求 URL、HTTP 状态与简要错误日志
              </strong>
              等。此类信息通常无法单独识别特定自然人。
            </li>
            <li>
              <strong className="text-slate-800">Cookies 与本地存储：</strong>
              我们可能使用 Cookies 或类似技术维持会话、记住偏好或分析流量（若启用）。您可通过浏览器设置限制 Cookies，但部分功能可能受影响。
            </li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            <strong className="text-slate-800">公开信息整理：</strong>
            AI Pulse 展示的行业动态与事件摘要主要来自<strong className="font-medium text-slate-800">公开可得的来源链接与文本</strong>
            ，该等内容不构成对您个人信息的收集。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">三、我们如何使用信息</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 marker:text-slate-400">
            <li>提供、维护与改进本站功能（榜单、事件页、周报与归档等）；</li>
            <li>处理订阅请求、发送周报邮件及管理退订；</li>
            <li>保障系统与数据安全、防范滥用与攻击；</li>
            <li>在符合法律要求的前提下，进行匿名的统计分析以优化产品体验。</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            我们不会将您的邮箱用于与本站服务无关的营销轰炸；如需开展新的邮件用途，我们将另行征得同意或提供明确退出方式。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">四、存储、保留与安全</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            我们会在实现本政策所述目的所必需的期限内保留您的信息，并在不再有合法依据继续保留时删除或匿名化处理。我们采取合理的技术与管理措施保护数据，但无法保证互联网传输或存储的绝对安全。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">五、共享与披露</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            我们不会向无关第三方出售您的个人信息。仅在以下情形可能共享或披露：经您同意；为履行法定义务或响应有权机关合法要求；与协助我们运营的基础设施或邮件发送服务提供商在<strong className="font-medium text-slate-800">
              最小必要
            </strong>
            范围内处理；或法律法规允许的其他情形。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">六、您的权利</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            在适用法律允许的范围内，您可就个人信息行使查阅、更正、删除、限制处理、撤回同意等权利。若您通过邮箱订阅，通常可通过邮件中的退订链接或联系我们撤回订阅。如需协助，请使用本站「关于我们」页提供的联系方式。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">七、未成年人</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            本站主要面向成年人及具备相应民事行为能力的用户。若您为未成年人，请在监护人同意与指导下使用本站功能。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">八、政策更新</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            我们可能适时修订本政策，并在本站显著位置发布更新版本及生效日期。重大变更时，我们将尽力以合理方式提示您。
          </p>
        </section>

        <section className={cardPlain}>
          <h2 className="font-headline text-lg font-bold text-slate-900">九、联系我们</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            如对本政策有疑问，请通过
            <a
              href={`mailto:${email}`}
              className="mx-1 font-medium text-[#2563EB] underline-offset-2 hover:underline"
            >
              {email}
            </a>
            与我们联系。
          </p>
        </section>

        <p className="text-center text-sm text-slate-500">
          <Link to="/terms" className="font-medium text-[#2563EB] underline-offset-2 hover:underline">
            查看服务条款
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
