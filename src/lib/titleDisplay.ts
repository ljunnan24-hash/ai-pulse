/** 标题展示：优先中文主标题，分隔符后的原文作小字（不改 API，仅解析现有 title 字符串） */

function hasCjk(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s);
}

/** 供榜单等模块判断是否为中文标题（含中日韩统一表意文字） */
export function hasCjkChars(s: string | undefined | null): boolean {
  return hasCjk((s ?? '').trim());
}

/** 取「发生了什么」里第一条含中文的语句，用作英文标题时的辅助主标题（完整展示在正文，此处仅作标题行） */
function firstChineseSentenceFromBody(body: string): string {
  const t = (body || '').trim();
  if (!t) return '';
  const byBreak = t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  for (const block of byBreak) {
    const sentences = block.split(/(?<=[。！？])/);
    for (const s of sentences) {
      const x = s.trim();
      if (x && hasCjk(x)) return x;
    }
    if (hasCjk(block)) return block;
  }
  return '';
}

/**
 * 详情页大标题：分隔符双语标题优先；否则英文标题 + 中文「发生了什么」首句时，主标题用中文句、原题作副标题
 */
export function deriveEventPageHeading(
  title: string | undefined | null,
  what_happened: string | undefined | null,
): { primary: string; subtitleLine?: string } {
  const split = splitTitleForDisplay(title);
  if (split.secondary) {
    return { primary: split.primary, subtitleLine: `原文标题：${split.secondary}` };
  }
  if (hasCjk(split.primary)) return { primary: split.primary };

  const cand = firstChineseSentenceFromBody(what_happened ?? '');
  if (cand.length >= 6) {
    return { primary: cand, subtitleLine: `原题：${split.primary}` };
  }
  return { primary: split.primary };
}

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
