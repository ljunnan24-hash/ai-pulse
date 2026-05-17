const DISMISS_KEY = 'aipulse_pwa_install_dismissed';
const DISMISS_DAYS = 14;

export type PwaPlatform = 'ios' | 'android-chrome' | 'other-mobile' | 'desktop';

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** 微信、QQ 等内置浏览器无法直接 PWA 添加快捷方式 */
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger|Weibo|(QQ\/|MQQBrowser)|DingTalk|AlipayClient/i.test(navigator.userAgent);
}

export function detectPwaPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua) && /Chrome/i.test(ua)) return 'android-chrome';
  if (isMobileUserAgent()) return 'other-mobile';
  return 'desktop';
}

export function wasInstallPromptDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function shouldOfferInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  if (isStandaloneMode()) return false;
  if (!isMobileUserAgent()) return false;
  if (wasInstallPromptDismissed()) return false;
  const platform = detectPwaPlatform();
  return platform === 'ios' || platform === 'android-chrome';
}
