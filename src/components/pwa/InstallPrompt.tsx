import { Share, Smartphone, X } from 'lucide-react';

import { usePwaInstallContext } from '../../contexts/PwaInstallContext';
import { isAndroidDevice, isInAppBrowser } from '../../lib/pwaInstall';

export function InstallPrompt() {
  const {
    visible,
    manualOpen,
    platform,
    closeInstallPrompt,
    install,
    installing,
    canNativeInstall,
  } = usePwaInstallContext();

  if (!visible || !manualOpen) return null;

  const isIos = platform === 'ios';
  const isAndroidChrome = platform === 'android-chrome';
  const isAndroid = isAndroidChrome || (platform === 'other-mobile' && isAndroidDevice());
  const isDesktop = platform === 'desktop';
  const inAppBrowser = isInAppBrowser();

  const description = isIos
    ? '像 App 一样从主屏幕打开 AI Pulse，更快查看排行榜与周报。'
    : isDesktop
      ? '在电脑创建快捷方式，可从桌面或开始菜单快速打开，无需每次输入网址。'
      : isAndroidChrome && canNativeInstall
        ? '点击按钮即可将 AI Pulse 添加到主屏幕，像 App 一样快速打开。'
        : '将快捷方式添加到主屏幕，随时查看 AI 情报。';

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="card-surface overflow-hidden shadow-lg ring-1 ring-slate-200/80">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <img
              src="/icons/apple-touch-icon.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-xl shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 id="pwa-install-title" className="font-headline text-base font-bold text-slate-900 sm:text-sm">
                  添加快捷方式
                </h2>
                <button
                  type="button"
                  onClick={closeInstallPrompt}
                  className="-mr-1 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 sm:p-1.5"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <p id="pwa-install-desc" className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-xs">
                {description}
              </p>

              {inAppBrowser && (isIos || isAndroid) ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                  当前在微信等 App 内打开，无法直接添加快捷方式。请点击右上角 <strong>⋯</strong> →{' '}
                  <strong>在浏览器中打开</strong>（安卓推荐 Chrome），再按下方步骤操作。
                </p>
              ) : null}

              {isIos ? (
                <ol className="mt-3 space-y-2.5 text-sm text-slate-700 sm:text-xs sm:space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary sm:h-5 sm:w-5 sm:text-[11px]">
                      1
                    </span>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      在 Safari 底部点击
                      <Share className="h-4 w-4 text-primary sm:h-3.5 sm:w-3.5" aria-hidden />
                      <strong>分享</strong>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary sm:h-5 sm:w-5 sm:text-[11px]">
                      2
                    </span>
                    <span>
                      选择 <strong>添加到主屏幕</strong>
                    </span>
                  </li>
                </ol>
              ) : canNativeInstall ? (
                <>
                  <button
                    type="button"
                    onClick={() => void install()}
                    disabled={installing}
                    className={`btn-primary flex w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                      isAndroid
                        ? 'mt-4 min-h-[44px] py-3 sm:mt-3 sm:min-h-0 sm:py-2.5'
                        : 'mt-3 py-2.5'
                    }`}
                  >
                    <Smartphone className="h-4 w-4" aria-hidden />
                    {installing ? '正在添加…' : '添加快捷方式'}
                  </button>
                  {isAndroid ? (
                    <p className="mt-2 text-xs text-slate-500">添加后可在主屏幕找到 AI Pulse 图标</p>
                  ) : null}
                </>
              ) : !isDesktop ? (
                <ol className="mt-3 space-y-2.5 text-sm text-slate-700 sm:text-xs sm:space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary sm:h-5 sm:w-5 sm:text-[11px]">
                      1
                    </span>
                    <span>
                      点击浏览器右上角 <strong>⋮</strong> 菜单
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary sm:h-5 sm:w-5 sm:text-[11px]">
                      2
                    </span>
                    <span>
                      选择 <strong>添加到主屏幕</strong> 或 <strong>添加快捷方式</strong>
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="mt-3 space-y-2 text-xs text-slate-700">
                  <li className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      1
                    </span>
                    <span>
                      点击地址栏右侧的 <strong>安装</strong> 图标，或浏览器菜单中的「安装 AI Pulse」
                    </span>
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={closeInstallPrompt}
                className="mt-3 w-full min-h-[40px] py-2 text-sm text-slate-400 transition hover:text-slate-600 sm:mt-2 sm:min-h-0 sm:py-1.5 sm:text-xs"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
