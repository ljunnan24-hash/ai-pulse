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

/** 周报条目（沿用后端已有字段名，不改 API） */
export type WeeklyLooseRow = Record<string, string>;

function normalizeWeeklyRow(raw: unknown): WeeklyLooseRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? '').trim();
  if (!title) return null;
  return {
    title: title.slice(0, 400),
    url: String(o.url ?? '').trim(),
    what_happened: String(o.what_happened ?? '').trim(),
    why_important: String(o.why_important ?? '').trim(),
    what_it_means_for_you: String(o.what_it_means_for_you ?? '').trim(),
    pulse_score: String(o.pulse_score ?? ''),
    theme: String(o.theme ?? o.category ?? '').trim(),
    event_id: String(o.event_id ?? '').trim(),
    source_name: String(o.source_name ?? '').trim(),
  };
}

/**
 * 组装「本周最重要的若干条信息」（最多 5 条）：优先显式 top5_information；否则合并 top3 与分类条目补足。
 */
export function collectWeeklyTopInformation(normal: Record<string, unknown>): WeeklyLooseRow[] {
  const explicit = normal.top5_information;
  if (Array.isArray(explicit) && explicit.length > 0) {
    const rows: WeeklyLooseRow[] = [];
    for (const x of explicit) {
      const r = normalizeWeeklyRow(x);
      if (r) rows.push(r);
      if (rows.length >= 5) break;
    }
    if (rows.length > 0) return rows;
  }

  const t3j = (normal.top3_judgments as WeeklyLooseRow[] | undefined) || [];
  const leg = (normal.top3 as WeeklyLooseRow[] | undefined) || [];
  const primary = t3j.length > 0 ? t3j : leg;
  const out: WeeklyLooseRow[] = [];

  for (const row of primary) {
    const r = normalizeWeeklyRow(row);
    if (r) out.push(r);
    if (out.length >= 5) return out.slice(0, 5);
  }

  const sections = (normal.sections as Array<{ items?: unknown[] }> | undefined) || [];
  outer: for (const sec of sections) {
    for (const it of sec.items || []) {
      if (out.length >= 5) break outer;
      const r = normalizeWeeklyRow(it);
      if (!r) continue;
      if (out.some((x) => x.title === r.title)) continue;
      out.push(r);
    }
  }

  return out.slice(0, 5);
}

export function isAffirmativeNoise(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === 'yes' || t === 'y' || t === '是' || t === 'true';
}
