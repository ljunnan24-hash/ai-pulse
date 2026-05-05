/** 周报 payload 解析与展示辅助（不改 API，仅前端容错） */

export function fmtBoundaryField(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join('；');
  return String(v);
}

export function linesFromBoundaryField(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = fmtBoundaryField(v);
  if (!s) return [];
  return s
    .split(/[；;\n\u2028]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export type GlossaryRow = { term: string; explain: string };

export function normalizeGlossary(payload: Record<string, unknown>, normal: Record<string, unknown>): GlossaryRow[] {
  const raw = (payload.glossary ?? normal.glossary) as unknown;
  if (!Array.isArray(raw)) return [];
  const rows: GlossaryRow[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const term = String(o.term ?? o.word ?? o.name ?? '').trim();
    const explain = String(o.explanation ?? o.definition ?? o.desc ?? o.explain ?? '').trim();
    if (!term && !explain) continue;
    rows.push({ term, explain });
    if (rows.length >= 6) break;
  }
  return rows;
}

/** 粗略估算中文阅读分钟数（字符数 / 每分钟阅读量） */
export function estimateReadingMinutes(payload: Record<string, unknown>): number {
  const blob = JSON.stringify(payload);
  const minutes = Math.ceil(blob.length / 420);
  return Math.max(3, Math.min(30, minutes || 6));
}

export function isAffirmativeNoise(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === 'yes' || t === 'y' || t === '是' || t === 'true';
}
