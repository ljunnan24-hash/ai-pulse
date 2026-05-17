import { Share, Smartphone, X } from 'lucide-react';

import { usePwaInstallContext } from '../../contexts/PwaInstallContext';

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
  const isDesktop = platform === 'desktop';

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="card-surface overflow-hidden shadow-lg ring-1 ring-slate-200/80">
            <div className="flex items-start gap-3 p-4">
              <img
                src="/icons/apple-touch-icon.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-xl shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 id="pwa-install-title" className="font-headline text-sm font-bold text-slate-900">
                    添加到主屏幕
                  </h2>
                  <button
                    type="button"
                    onClick={closeInstallPrompt}
                    className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="关闭"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <p id="pwa-install-desc" className="mt-1 text-xs leading-relaxed text-slate-600">
                  {isIos
                    ? '像 App 一样从主屏幕打开 AI Pulse，更快查看排行榜与周报。'
                    : isDesktop
                      ? '将 AI Pulse 安装到电脑，可从桌面或开始菜单快速打开。'
                      : '安装到主屏幕，离线也能打开首页，随时查看 AI 情报。'}
                </p>

                {isIos ? (
                  <ol className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        1
                      </span>
                      <span className="inline-flex items-center gap-1">
                        点击浏览器底部的
                        <Share className="h-3.5 w-3.5 text-primary" aria-hidden />
                        <strong>分享</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        2
                      </span>
                      <span>
                        选择 <strong>添加到主屏幕</strong>
                      </span>
                    </li>
                  </ol>
                ) : canNativeInstall ? (
                  <button
                    type="button"
                    onClick={() => void install()}
                    disabled={installing}
                    className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Smartphone className="h-4 w-4" aria-hidden />
                    {installing ? '正在安装…' : '立即安装'}
                  </button>
                ) : (
                  <ol className="mt-3 space-y-2 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        1
                      </span>
                      <span>
                        {isDesktop ? (
                          <>
                            点击地址栏右侧的 <strong>安装</strong> 图标，或浏览器菜单中的「安装 AI Pulse」
                          </>
                        ) : (
                          <>
                            点击浏览器右上角 <strong>⋮</strong> 菜单
                          </>
                        )}
                      </span>
                    </li>
                    {!isDesktop ? (
                      <li className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          2
                        </span>
                        <span>
                          选择 <strong>安装应用</strong> 或 <strong>添加到主屏幕</strong>
                        </span>
                      </li>
                    ) : null}
                  </ol>
                )}

                <button
                  type="button"
                  onClick={closeInstallPrompt}
                  className="mt-2 w-full py-1.5 text-xs text-slate-400 transition hover:text-slate-600"
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
