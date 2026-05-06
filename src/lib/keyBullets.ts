/** 从叙事正文提炼若干条「关键信息」列表（不改 API，仅前端拆分） */

export function keyBulletPoints(text: string | undefined | null, maxItems = 6): string[] {
  const t = (text ?? '').trim();
  if (!t) return [];
  const byNl = t
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (byNl.length >= 2) return byNl.slice(0, maxItems);
  const sentences = t
    .split(/(?<=[。！？!?])/u)
    .map((x) => x.trim())
    .filter(Boolean);
  return sentences.length ? sentences.slice(0, maxItems) : [t.slice(0, 400)];
}
