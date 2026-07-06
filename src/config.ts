/** Backend base URL (no trailing slash). Dev: use Vite proxy so '' works. */
export function apiBase(): string {
  const v = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (v !== undefined && v !== '') return v.replace(/\/$/, '');
  return '';
}

export function contactEmail(): string {
  const v = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
  return (v || 'contact@example.com').trim();
}

export function optionalAssetUrl(key: 'VITE_WECHAT_GROUP_QR_SRC' | 'VITE_REWARD_QR_SRC'): string {
  const v = import.meta.env[key] as string | undefined;
  return (v || '').trim();
}

export function siteUrl(): string {
  const v = import.meta.env.VITE_SITE_URL as string | undefined;
  if (v && v.trim()) return v.trim().replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://www.aipulse.asia';
}
