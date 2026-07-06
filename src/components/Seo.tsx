import { useEffect } from 'react';

import { siteUrl } from '../config';

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  noindex?: boolean;
};

const SITE_NAME = 'AI Pulse';
const DEFAULT_DESCRIPTION = 'AI Pulse 每日追踪 AI 新闻、产品发布、开源项目和行业信号，提供中文 AI 排行榜、事件解读与每周周报。';
const MANAGED_SELECTOR = 'meta[data-aipulse-seo], link[data-aipulse-seo], script[data-aipulse-seo]';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('data-aipulse-seo', 'true');
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    el.setAttribute('data-aipulse-seo', 'true');
    document.head.appendChild(el);
  }
  el.href = href;
}

export function absoluteUrl(path = '/') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl()}${cleanPath}`;
}

export function Seo({
  title,
  description,
  path = '/',
  type = 'website',
  publishedTime,
  jsonLd,
  noindex = false,
}: SeoProps) {
  useEffect(() => {
    const finalTitle = title.trim() || SITE_NAME;
    const finalDescription = description.trim() || DEFAULT_DESCRIPTION;
    const url = absoluteUrl(path);

    document.title = finalTitle;
    upsertMeta('name', 'description', finalDescription);
    upsertMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:title', finalTitle);
    upsertMeta('property', 'og:description', finalDescription);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', finalTitle);
    upsertMeta('name', 'twitter:description', finalDescription);
    if (publishedTime) upsertMeta('property', 'article:published_time', publishedTime);
    upsertCanonical(url);

    document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"][data-aipulse-seo]').forEach((el) => {
      el.remove();
    });
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-aipulse-seo', 'true');
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [description, jsonLd, noindex, path, publishedTime, title, type]);

  return null;
}

export function clearManagedSeo() {
  document.head.querySelectorAll(MANAGED_SELECTOR).forEach((el) => el.remove());
}
