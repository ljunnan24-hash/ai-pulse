/** 标题展示：优先中文主标题，分隔符后的原文作小字（不改 API，仅解析现有 title 字符串） */

export function splitTitleForDisplay(raw: string | undefined | null): { primary: string; secondary?: string } {
  const t = (raw ?? '').trim();
  if (!t) return { primary: '未命名事件' };

  const seps = ['｜', '|', ' — ', ' – ', ' —', ' –'] as const;
  for (const sep of seps) {
    const i = t.indexOf(sep);
    if (i > 0 && i < t.length - sep.length) {
      const a = t.slice(0, i).trim();
      const b = t.slice(i + sep.length).trim();
      if (a && b) {
        const aCjk = /[\u4e00-\u9fff]/.test(a);
        const bCjk = /[\u4e00-\u9fff]/.test(b);
        if (aCjk && !bCjk) return { primary: a, secondary: b };
        if (!aCjk && bCjk) return { primary: b, secondary: a };
        return { primary: a, secondary: b };
      }
    }
  }

  return { primary: t };
}
